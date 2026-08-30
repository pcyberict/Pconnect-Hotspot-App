FROM node:22-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/pconnect/package.json artifacts/pconnect/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Compress packaged WebP assets in the build stage only. The runtime image
# does not need to carry the image conversion tool.
RUN apt-get update \
  && apt-get install --no-install-recommends -y webp \
  && sh scripts/compress-static-images.sh artifacts/pconnect/public \
  && rm -rf /var/lib/apt/lists/*

RUN PORT=20402 BASE_PATH=/ NODE_ENV=production \
  pnpm --filter @workspace/pconnect run build

RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=8080
WORKDIR /app

RUN apt-get update \
  && apt-get install --no-install-recommends -y nginx \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default

COPY nginx.pconnect.conf /etc/nginx/conf.d/pconnect.conf
COPY --from=build /app/artifacts/pconnect/dist/public /usr/share/nginx/html
COPY --from=build /app/artifacts/api-server/dist ./api-dist
COPY scripts/inject-site-metadata.mjs /app/scripts/inject-site-metadata.mjs
COPY docker-start.sh /usr/local/bin/docker-start.sh

RUN chmod +x /usr/local/bin/docker-start.sh

EXPOSE 80 8080

CMD ["/usr/local/bin/docker-start.sh"]