import { useState, useRef } from "react";
import { useQuery, useMutation } from "@/lib/pconnect-api.ts";
import { Upload, Plus, Ban, RotateCcw, Trash2, CloudUpload, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/pconnect-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type Id<T extends string> = string;

type VoucherStatus = "available" | "reserved" | "sold" | "disabled";

const STATUS_COLORS: Record<VoucherStatus, string> = {
  available: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  reserved: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  sold: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  disabled: "text-red-400 bg-red-500/15 border-red-500/30",
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1a0b30]/80 p-5">
      <div className={`text-3xl font-extrabold ${color}`}>{value.toLocaleString()}</div>
      <div className="mt-1 text-sm text-white/40">{label}</div>
    </div>
  );
}

export default function AdminInventory() {
  const plans = useQuery(api.voucherPlans.listAllPlans, {});
  const inventory = useQuery(api.vouchers.getInventoryCounts, {});
  const vouchers = useQuery(api.vouchers.listVouchersAdminRich, {});
  const setStatus = useMutation(api.vouchers.setVoucherStatus);
  const deleteVoucher = useMutation(api.vouchers.deleteVoucher);
  const bulkImport = useMutation(api.vouchers.bulkImportVouchers);
  const createVoucher = useMutation(api.vouchers.createSingleVoucher);

  const [selectedPlan, setSelectedPlan] = useState<Id<"voucherPlans"> | "">("");
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | "">("");
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [showSingle, setShowSingle] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"vouchers"> | null>(null);
  const [bulkPlan, setBulkPlan] = useState<Id<"voucherPlans"> | "">("");
  const [bulkText, setBulkText] = useState("user01,pass01\nuser02,pass02");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [singlePlan, setSinglePlan] = useState<Id<"voucherPlans"> | "">("");
  const [singleUser, setSingleUser] = useState("");
  const [singlePass, setSinglePass] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseRows = (raw: string) => {
    const lines = raw.trim().split("\n").filter(Boolean);
    const rows: { username: string; password: string; valid: boolean }[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const parts = line.includes(",") ? line.split(",") : line.split(/\t+/);
      const username = parts[0]?.trim();
      const password = parts[1]?.trim();
      const valid = !!(username && password);
      const duplicate = seen.has(username ?? "");
      if (username) seen.add(username);
      rows.push({ username: username ?? "", password: password ?? "", valid: valid && !duplicate });
    }
    return rows;
  };

  const bulkRows = parseRows(bulkText);
  const validBulkRows = bulkRows.filter(r => r.valid);

  const filtered = vouchers?.filter(v => {
    if (selectedPlan && v.planId !== selectedPlan) return false;
    if (statusFilter && v.status !== statusFilter) return false;
    if (search && !v.username.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) ?? [];

  const handleSetStatus = async (voucherId: Id<"vouchers">, status: "available" | "disabled") => {
    try {
      await setStatus({ voucherId, status });
      toast.success(status === "available" ? "Voucher restored" : "Voucher disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const handleDelete = async (voucherId: Id<"vouchers">) => {
    setDeletingId(voucherId);
    try {
      await deleteVoucher({ voucherId });
      toast.success("Voucher deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setDeletingId(null); }
  };

  const handleBulkImport = async () => {
    if (!bulkPlan) { toast.error("Select a plan first"); return; }
    if (validBulkRows.length === 0) { toast.error("No valid rows found"); return; }
    setBulkLoading(true);
    try {
      const result = await bulkImport({ planId: bulkPlan, vouchers: validBulkRows.map(r => ({ username: r.username, password: r.password })) });
      setBulkResult(result);
      toast.success(`Imported ${result.inserted} vouchers`);
      setBulkText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setBulkLoading(false); }
  };

  const handleSingleAdd = async () => {
    if (!singlePlan) { toast.error("Select a plan"); return; }
    setSingleLoading(true);
    try {
      await createVoucher({ planId: singlePlan, username: singleUser, password: singlePass });
      toast.success("Voucher added");
      setSingleUser(""); setSinglePass("");
      setShowSingle(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSingleLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Vouchers</h1>
          <p className="text-sm text-white/40 mt-0.5">Manage your voucher inventory.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setShowSingle(v => !v); setShowBulk(false); }}><Plus size={13} /> Single</Button>
          <Button size="sm" variant="glossy" onClick={() => { setShowBulk(v => !v); setShowSingle(false); }}><Upload size={13} /> Bulk Upload</Button>
        </div>
      </div>
      {inventory && (
        <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
          <StatCard label="In stock" value={inventory.available} color="text-white" />
          <StatCard label="Sold" value={inventory.sold} color="text-purple-400" />
          <StatCard label="Disabled" value={inventory.disabled} color="text-red-400" />
          <StatCard label="Total" value={inventory.available + inventory.sold + inventory.disabled + inventory.reserved} color="text-white/60" />
        </div>
      )}
      {showBulk && (
        <div className="rounded-2xl border border-[#7519e9]/30 bg-[#1a0b30] p-6 mb-6">
          <div className="flex items-center gap-3 mb-1"><CloudUpload size={20} className="text-purple-400" /><h2 className="text-lg font-bold text-white">Bulk upload</h2></div>
          <p className="text-sm text-white/40 mb-4">One voucher per line: username,password</p>
          {bulkResult ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm space-y-1">
              <div className="text-emerald-400 font-semibold">Import complete</div>
              <div className="text-white/70">Imported: <span className="text-emerald-300 font-bold">{bulkResult.inserted}</span> &nbsp; Skipped: <span className="text-amber-300 font-bold">{bulkResult.skipped}</span></div>
              <button onClick={() => { setBulkResult(null); }} className="text-purple-400 text-xs underline cursor-pointer mt-1">Import more</button>
            </div>
          ) : (
            <>
              <select value={bulkPlan} onChange={e => setBulkPlan(e.target.value as Id<"voucherPlans"> | "")} className="w-full mb-3 rounded-xl border border-white/10 bg-[#0e0620] px-4 py-3 text-sm text-white focus:outline-none cursor-pointer">
                <option value="">Select a plan...</option>
                {plans?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <textarea className="w-full rounded-xl border border-white/10 bg-[#0e0620] p-4 font-mono text-sm text-white focus:outline-none resize-y min-h-[120px] mb-2" value={bulkText} onChange={e => setBulkText(e.target.value)} />
              <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                <span>{bulkRows.length} rows · {validBulkRows.length} valid</span>
                <button onClick={() => fileInputRef.current?.click()} className="text-purple-400 underline cursor-pointer">Upload CSV</button>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setBulkText(ev.target?.result as string ?? ""); r.readAsText(f); } }} />
              <div className="flex gap-2">
                <Button variant="glossy" size="sm" disabled={bulkLoading || !bulkPlan || validBulkRows.length === 0} onClick={() => void handleBulkImport()}><Upload size={13} /> {bulkLoading ? "Importing…" : `Import (${validBulkRows.length})`}</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowBulk(false)}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}
      {showSingle && (
        <div className="rounded-2xl border border-[#7519e9]/30 bg-[#1a0b30] p-5 mb-6">
          <h3 className="text-base font-bold text-white mb-4">Add Single Voucher</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select value={singlePlan} onChange={e => setSinglePlan(e.target.value as Id<"voucherPlans"> | "")} className="rounded-xl border border-white/10 bg-[#0e0620] px-3 py-2.5 text-sm text-white focus:outline-none cursor-pointer">
              <option value="">Select plan...</option>
              {plans?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <input placeholder="Username" value={singleUser} onChange={e => setSingleUser(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none" />
            <input placeholder="Password" value={singlePass} onChange={e => setSinglePass(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="glossy" size="sm" disabled={singleLoading || !singlePlan || !singleUser || !singlePass} onClick={() => void handleSingleAdd()}><Plus size={13} /> Add</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSingle(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Search size={14} className="text-white/30 shrink-0" />
          <input placeholder="Search username..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none" />
        </div>
        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none cursor-pointer" value={selectedPlan} onChange={e => setSelectedPlan(e.target.value as Id<"voucherPlans"> | "")}>
          <option value="">All plans</option>
          {plans?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value as VoucherStatus | "")}>
          <option value="">All status</option>
          {(["available", "reserved", "sold", "disabled"] as VoucherStatus[]).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        {vouchers !== undefined && <span className="text-sm text-white/30 ml-auto">{filtered.length} shown</span>}
      </div>
      {vouchers === undefined ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/30">No vouchers found.</div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">
            <div>Username</div><div>Plan</div><div>Status</div><div>Purchased</div><div></div>
          </div>
          {filtered.map(v => (
            <div key={v._id} className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-4 items-center border-b border-white/5 px-4 py-3.5 hover:bg-white/[0.03] transition-colors">
              <div className="font-mono text-sm text-white truncate">{v.username}</div>
              <div className="text-sm text-white/60 truncate">{v.planName}</div>
              <div><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[v.status]}`}>{v.status}</span></div>
              <div className="text-xs text-white/40">{v.soldAt ? new Date(v.soldAt).toLocaleString() : "—"}</div>
              <div className="flex items-center gap-1">
                {v.status === "available" && <button onClick={() => void handleSetStatus(v._id, "disabled")} title="Disable" className="cursor-pointer rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-amber-400 transition-colors"><Ban size={14} /></button>}
                {v.status === "disabled" && <button onClick={() => void handleSetStatus(v._id, "available")} title="Restore" className="cursor-pointer rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-emerald-400 transition-colors"><RotateCcw size={14} /></button>}
                {v.status !== "sold" && <button onClick={() => void handleDelete(v._id)} disabled={deletingId === v._id} title="Delete" className="cursor-pointer rounded-lg p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
