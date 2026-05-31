import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, FileText, FileSpreadsheet, Lock, ShieldAlert } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  encryptBackup, decryptBackup, toCSV, downloadFile, type BackupEntry,
} from "@/lib/backup";

type Props = {
  entries: BackupEntry[];
  onImported: () => void;
};

export function BackupDialog({ entries, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFileText, setPendingFileText] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportEncrypted = async () => {
    if (passphrase.length < 8) {
      toast.error("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPass) {
      toast.error("Passphrases don't match");
      return;
    }
    if (entries.length === 0) {
      toast.error("No entries to back up");
      return;
    }
    setBusy(true);
    try {
      const data = await encryptBackup(entries, passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`nebula-vault-${stamp}.nvault.json`, "application/json", data);
      toast.success("Encrypted backup downloaded");
      setPassphrase("");
      setConfirmPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    if (entries.length === 0) return toast.error("No entries to export");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`nebula-vault-${stamp}.csv`, "text/csv", toCSV(entries));
    toast.success("CSV downloaded — store it somewhere safe");
  };

  const exportPDF = () => {
    if (entries.length === 0) return toast.error("No entries to export");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;
    doc.setFontSize(18);
    doc.text("Nebula Vault — Password Backup", margin, y);
    y += 22;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(
      `Exported ${new Date().toLocaleString()}  •  ${entries.length} entries`,
      margin,
      y
    );
    doc.setTextColor(0);
    y += 24;
    doc.setFontSize(11);

    for (const e of entries) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.text(e.website, margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      const lines = [
        `User: ${e.username}`,
        `Pass: ${e.password}`,
      ];
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line, 515);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 14;
      }
      y += 8;
      doc.setDrawColor(220);
      doc.line(margin, y, 555, y);
      y += 12;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`nebula-vault-${stamp}.pdf`);
    toast.success("PDF downloaded — store it somewhere safe");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      setPendingFileText(text);
    } catch {
      toast.error("Couldn't read file");
    }
  };

  const importDecrypted = async () => {
    if (!pendingFileText) return;
    if (!importPass) return toast.error("Enter the backup passphrase");
    setBusy(true);
    try {
      const decrypted = await decryptBackup(pendingFileText, importPass);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const rows = decrypted.map((e) => ({ ...e, user_id: u.user!.id }));
      const { error } = await supabase.from("vault_entries").insert(rows);
      if (error) throw error;
      toast.success(`Restored ${rows.length} entries`);
      setImportPass("");
      setPendingFileText(null);
      setOpen(false);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setPassphrase(""); setConfirmPass(""); setImportPass(""); setPendingFileText(null);
      }
    }}>
      <Button variant="outline" onClick={() => setOpen(true)} className="glass">
        <Download className="h-4 w-4 mr-2" /> Backup
      </Button>
      <DialogContent className="glass max-w-md">
        <DialogHeader>
          <DialogTitle>Backup &amp; Restore</DialogTitle>
          <DialogDescription>
            Export your vault to a file, or restore from an encrypted backup.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-5 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-primary" /> Encrypted backup (recommended)
              </div>
              <p className="text-xs text-muted-foreground">
                AES-256-GCM with a passphrase you choose. Required to restore.
              </p>
              <div className="space-y-2">
                <Label htmlFor="pass">Passphrase</Label>
                <Input id="pass" type="password" value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass2">Confirm passphrase</Label>
                <Input id="pass2" type="password" value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  autoComplete="new-password" />
              </div>
              <Button onClick={exportEncrypted} disabled={busy}
                className="w-full bg-aurora text-primary-foreground border-0 glow">
                <Lock className="h-4 w-4 mr-2" />
                {busy ? "Encrypting..." : "Download encrypted backup"}
              </Button>
            </div>

            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-muted-foreground flex gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span>
                CSV and PDF exports are <strong>unencrypted</strong>. Anyone with
                the file can read your passwords. Store them offline only.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={exportCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button variant="outline" onClick={exportPDF}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Restore from a <code>.nvault.json</code> file. Entries are added
              alongside your existing ones.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={onPickFile}
              className="hidden"
            />
            <Button variant="outline" className="w-full"
              onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {pendingFileText ? "Choose a different file" : "Choose backup file"}
            </Button>

            {pendingFileText && (
              <div className="space-y-2">
                <Label htmlFor="ipass">Backup passphrase</Label>
                <Input id="ipass" type="password" value={importPass}
                  onChange={(e) => setImportPass(e.target.value)}
                  autoComplete="current-password" />
              </div>
            )}

            <DialogFooter>
              <Button onClick={importDecrypted}
                disabled={busy || !pendingFileText}
                className="w-full bg-aurora text-primary-foreground border-0 glow">
                {busy ? "Restoring..." : "Decrypt & restore"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
