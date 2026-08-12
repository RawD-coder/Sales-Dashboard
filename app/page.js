'use client'
import { useEffect, useState } from 'react';

export default function LaporanPenjualan() {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'perJudul' | 'royalti'>('ringkasan');
  
  const [laporanBulanan, setLaporanBulanan] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState({ marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0 });
  
  const [dataPerJudulMentah, setDataPerJudulMentah] = useState<Record<string, any>>({});
  const [daftarBulan, setDaftarBulan] = useState<{key: string, name: string}[]>([]);
  const [selectedBulan, setSelectedBulan] = useState<string>('Semua');

  const [dataRoyaltiMentah, setDataRoyaltiMentah] = useState<Record<string, any>>({});
  const [daftarPeriode, setDaftarPeriode] = useState<string[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('Semua');

  const [loading, setLoading] = useState(true);

  const NAMA_KOLOM_TANGGAL = 'Date'; 
  const NAMA_KOLOM_PENJUALAN = 'Total'; 
  const NAMA_KOLOM_JUDUL = 'Description';
  const NAMA_KOLOM_KODE = 'Item_Code';

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // PERBAIKAN: Memaksa browser tidak menggunakan cache lama
        const res = await fetch('/api/sales', { cache: 'no-store' });
        const result = await res.json();

        const masterMap: Record<string, { royaltiFisik: number, royaltiPlaybook: number }> = {};
        
        // 1. MEMBUAT KAMUS MASTER (DENGAN PERLINDUNGAN ERROR TINGKAT TINGGI)
        (result.master || []).forEach((row: any) => {
          const findValue = (keywords: string[]) => {
              const keys = Object.keys(row);
              for (let k of keys) {
                  const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (keywords.some(kw => cleanK.includes(kw))) return row[k];
              }
              return null;
          };

          // Ambil Kode dan Judul, ubah jadi HURUF BESAR SEMUA dan hapus spasi berlebih
          const rawCode = row[NAMA_KOLOM_KODE] || row['Item Code'] || findValue(['itemcode', 'kode']);
          const rawTitle = row[NAMA_KOLOM_JUDUL] || findValue(['description', 'judul', 'nama']);
          
          const codeKey = rawCode ? String(rawCode).trim().toUpperCase() : null;
          const titleKey = rawTitle ? String(rawTitle).trim().toUpperCase() : null;

          const parsePercent = (val: string | null | undefined) => {
            if (!val) return 0;
            const strVal = String(val).trim().toLowerCase();
            let clean = strVal.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
            let num = parseFloat(clean);
            if (isNaN(num)) return 0;
            
            if (strVal.includes('%')) return num / 100;
            if (num > 1) return num / 100; // Asumsi jika ditulis 15 berarti 15%
            return num;
          };

          const tarifFisik = parsePercent(findValue(['royaltifisik', 'persentasefisik', 'royaltyfisik', 'fisik']));
          const tarifPlaybook = parsePercent(findValue(['royaltiplaybook', 'royaltidigital', 'persentaseplaybook', 'playbook', 'digital']));

          // Simpan kamus berdasarkan Kode (Prioritas 1) dan Judul (Prioritas 2)
          if (codeKey) {
            masterMap[codeKey] = { royaltiFisik: tarifFisik, royaltiPlaybook: tarifPlaybook };
          }
          if (titleKey) {
            masterMap[titleKey] = { royaltiFisik: tarifFisik, royaltiPlaybook: tarifPlaybook };
          }
        });

        const rekapBulanan: Record<string, any> = {};
        const rekapJudul: Record<string, any> = {}; 
        const rekapRoyalti: Record<string, any> = {}; 
        const totalKeseluruhan: Record<string, number> = { marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0 };
        const opsiBulan: Record<string, string> = {}; 
        const opsiPeriode: Set<string> = new Set(); 

        const prosesData = (sumberData: any[], namaSumber: string) => {
          sumberData.forEach((item: any) => {
            const tanggalMentah = item[NAMA_KOLOM_TANGGAL];
            if (!tanggalMentah) return; 

            // PARSING TANGGAL
            let bersihTanggal = String(tanggalMentah).trim();
            const bulanIndo: Record<string, string> = {
              'januari': 'January', 'februari': 'February', 'maret': 'March', 'april': 'April',
              'mei': 'May', 'juni': 'June', 'juli': 'July', 'agustus': 'August',
              'september': 'September', 'oktober': 'October', 'november': 'November', 'desember': 'December',
              'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr', 'agu': 'Aug', 'sep': 'Sep', 'okt': 'Oct', 'nov': 'Nov', 'des': 'Dec'
            };

            for (const [indo, inggris] of Object.entries(bulanIndo)) {
              const regex = new RegExp(`\\b${indo}\\b`, 'gi');
              bersihTanggal = bersihTanggal.replace(regex, inggris);
            }

            let dateObj;
            const cekFormatAngka = bersihTanggal.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
            if (cekFormatAngka) dateObj = new Date(`${cekFormatAngka[3]}-${cekFormatAngka[2].padStart(2,'0')}-${cekFormatAngka[1].padStart(2,'0')}T00:00:00`);
            else dateObj = new Date(bersihTanggal);

            if (isNaN(dateObj.getTime())) return; 

            // PARSING ANGKA
            let nilaiMentah = item[NAMA_KOLOM_PENJUALAN] || "0";
            if (typeof nilaiMentah === 'string') nilaiMentah = nilaiMentah.split(',')[0].replace(/[^0-9]/g, ''); 
            const nilaiPenjualan = parseInt(nilaiMentah, 10) || 0;
            const qtyItem = parseInt(item['Qty'], 10) || 0;
            
            // PEMBERSIHAN KODE & JUDUL (Hapus spasi, jadikan huruf besar)
            const judulItemAsli = String(item[NAMA_KOLOM_JUDUL] || 'Tanpa Judul').trim();
            const itemCodeKey = String(item[NAMA_KOLOM_KODE] || '').trim().toUpperCase();
            const titleKey = judulItemAsli.toUpperCase();

            // PENCARIAN TARIF (Cari by Kode Dulu, kalau gagal baru cari by Judul Buku)
            const tarifFisik = (masterMap[itemCodeKey]?.royaltiFisik) || (masterMap[titleKey]?.royaltiFisik) || 0;
            const tarifPlaybook = (masterMap[itemCodeKey]?.royaltiPlaybook) || (masterMap[titleKey]?.royaltiPlaybook) || 0;

            let nominalRoyaltiFisik = 0;
            let nominalRoyaltiPlaybook = 0;
            
            if (namaSumber === 'playbook') {
                nominalRoyaltiPlaybook = Math.round(nilaiPenjualan * tarifPlaybook);
            } else {
                nominalRoyaltiFisik = Math.round(nilaiPenjualan * tarifFisik);
            }

            const m = dateObj.getMonth();
            const y = dateObj.getFullYear();
            let namaPeriode = "";
            if (m >= 0 && m <= 3) namaPeriode = `Januari - April ${y}`;
            else if (m >= 4 && m <= 7) namaPeriode = `Mei - Agustus ${y}`;
            else namaPeriode = `September - Desember ${y}`;

            const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

            const itemCodeTampil = itemCodeKey || '-'; // Untuk tampilan di tabel

            if (!rekapBulanan[monthKey]) {
              rekapBulanan[monthKey] = { monthKey, monthName, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0 };
              opsiBulan[monthKey] = monthName; 
            }
            rekapBulanan[monthKey][namaSumber] += nilaiPenjualan;
            totalKeseluruhan[namaSumber] += nilaiPenjualan;
            if (namaSumber === 'marketplace' || namaSumber === 'tokoBuku') {
              rekapBulanan[monthKey][namaSumber + 'Qty'] += qtyItem;
              totalKeseluruhan[namaSumber + 'Qty'] += qtyItem;
            }

            if (!rekapJudul[monthKey]) rekapJudul[monthKey] = {};
            if (!rekapJudul[monthKey][itemCodeTampil]) rekapJudul[monthKey][itemCodeTampil] = { itemCode: itemCodeTampil, judulItem: judulItemAsli, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0 };
            rekapJudul[monthKey][itemCodeTampil][namaSumber] += nilaiPenjualan;
            if (namaSumber === 'marketplace' || namaSumber === 'tokoBuku') rekapJudul[monthKey][itemCodeTampil][namaSumber + 'Qty'] += qtyItem;

            if (!rekapJudul['Semua']) rekapJudul['Semua'] = {};
            if (!rekapJudul['Semua'][itemCodeTampil]) rekapJudul['Semua'][itemCodeTampil] = { itemCode: itemCodeTampil, judulItem: judulItemAsli, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0 };
            rekapJudul['Semua'][itemCodeTampil][namaSumber] += nilaiPenjualan;
            if (namaSumber === 'marketplace' || namaSumber === 'tokoBuku') rekapJudul['Semua'][itemCodeTampil][namaSumber + 'Qty'] += qtyItem;

            opsiPeriode.add(namaPeriode);
            if (!rekapRoyalti[namaPeriode]) rekapRoyalti[namaPeriode] = {};
            if (!rekapRoyalti[namaPeriode][itemCodeTampil]) {
                rekapRoyalti[namaPeriode][itemCodeTampil] = { 
                    itemCode: itemCodeTampil, judulItem: judulItemAsli, jualFisik: 0, jualPlaybook: 0, 
                    royaltiFisik: 0, royaltiPlaybook: 0, persentaseFisik: tarifFisik, persentasePlaybook: tarifPlaybook 
                };
            }
            if (namaSumber === 'playbook') {
                rekapRoyalti[namaPeriode][itemCodeTampil].jualPlaybook += nilaiPenjualan;
                rekapRoyalti[namaPeriode][itemCodeTampil].royaltiPlaybook += nominalRoyaltiPlaybook;
            } else {
                rekapRoyalti[namaPeriode][itemCodeTampil].jualFisik += nilaiPenjualan;
                rekapRoyalti[namaPeriode][itemCodeTampil].royaltiFisik += nominalRoyaltiFisik;
            }

            if (!rekapRoyalti['Semua']) rekapRoyalti['Semua'] = {};
            if (!rekapRoyalti['Semua'][itemCodeTampil]) {
                rekapRoyalti['Semua'][itemCodeTampil] = { 
                    itemCode: itemCodeTampil, judulItem: judulItemAsli, jualFisik: 0, jualPlaybook: 0, 
                    royaltiFisik: 0, royaltiPlaybook: 0, persentaseFisik: tarifFisik, persentasePlaybook: tarifPlaybook 
                };
            }
            if (namaSumber === 'playbook') {
                rekapRoyalti['Semua'][itemCodeTampil].jualPlaybook += nilaiPenjualan;
                rekapRoyalti['Semua'][itemCodeTampil].royaltiPlaybook += nominalRoyaltiPlaybook;
            } else {
                rekapRoyalti['Semua'][itemCodeTampil].jualFisik += nilaiPenjualan;
                rekapRoyalti['Semua'][itemCodeTampil].royaltiFisik += nominalRoyaltiFisik;
            }
          });
        };

        prosesData(result.marketplace || [], 'marketplace');
        prosesData(result.playbook || [], 'playbook');
        prosesData(result.tokoBuku || [], 'tokoBuku');

        const dataTerurut = Object.values(rekapBulanan).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey));
        setLaporanBulanan(dataTerurut);
        
        const arrBulan = Object.keys(opsiBulan).sort((a, b) => b.localeCompare(a)).map(k => ({ key: k, name: opsiBulan[k] }));
        setDaftarBulan([{key: 'Semua', name: 'Semua Waktu'}, ...arrBulan]);
        
        setDaftarPeriode(['Semua', ...Array.from(opsiPeriode).sort().reverse()]);

        setDataPerJudulMentah(rekapJudul);
        setDataRoyaltiMentah(rekapRoyalti);
        setGrandTotal({
          marketplace: totalKeseluruhan.marketplace, playbook: totalKeseluruhan.playbook, tokoBuku: totalKeseluruhan.tokoBuku,
          marketplaceQty: totalKeseluruhan.marketplaceQty, tokoBukuQty: totalKeseluruhan.tokoBukuQty
        });

      } catch (error) {
        console.error("Gagal memuat laporan", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-xl font-bold flex items-center justify-center min-h-screen text-indigo-700">Menyinkronkan Data Royalti Terbaru...</div>;

  const totalSemuaPendapatan = grandTotal.marketplace + grandTotal.playbook + grandTotal.tokoBuku;

  const dataJudulTampil = dataPerJudulMentah[selectedBulan] ? Object.values(dataPerJudulMentah[selectedBulan]).sort((a: any, b: any) => (b.marketplace + b.playbook + b.tokoBuku) - (a.marketplace + a.playbook + a.tokoBuku)) : [];
  
  const dataRoyaltiTampil = dataRoyaltiMentah[selectedPeriode] ? Object.values(dataRoyaltiMentah[selectedPeriode]).sort((a: any, b: any) => (b.royaltiFisik + b.royaltiPlaybook) - (a.royaltiFisik + a.royaltiPlaybook)) : [];

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-[90rem] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-slate-900">Dashboard Laporan Penjualan</h1>
        
        <div className="flex space-x-2 md:space-x-4 mb-8 bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-flex w-full md:w-auto overflow-x-auto">
          <button onClick={() => setActiveTab('ringkasan')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'ringkasan' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Ringkasan Bulanan</button>
          <button onClick={() => setActiveTab('perJudul')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'perJudul' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Detail Per Judul Buku</button>
          <button onClick={() => setActiveTab('royalti')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'royalti' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Laporan Royalti (Bagi Hasil)</button>
        </div>

        {activeTab === 'ringkasan' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 mb-8 shadow-lg text-white">
              <h2 className="text-lg md:text-xl font-medium text-slate-300 mb-2">Total Keseluruhan Pendapatan</h2>
              <p className="text-4xl md:text-6xl font-bold tracking-tight">{formatRupiah(totalSemuaPendapatan)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-6 bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-blue-500 flex flex-col justify-between">
                <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Marketplace</h2><p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.marketplace)}</p></div>
                <div className="mt-4"><span className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{grandTotal.marketplaceQty} Unit Terjual</span></div>
              </div>
              <div className="p-6 bg-white rounded-xl border border-emerald-200 shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-between">
                <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Playbook (Digital)</h2><p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.playbook)}</p></div>
              </div>
              <div className="p-6 bg-white rounded-xl border border-amber-200 shadow-sm border-l-4 border-l-amber-500 flex flex-col justify-between">
                <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Toko Buku</h2><p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.tokoBuku)}</p></div>
                <div className="mt-4"><span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full">{grandTotal.tokoBukuQty} Unit Terjual</span></div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                      <th className="p-4 font-bold">Bulan & Tahun</th><th className="p-4 font-bold">Marketplace</th><th className="p-4 font-bold">Playbook</th><th className="p-4 font-bold">Toko Buku</th><th className="p-4 font-bold bg-slate-200 border-l border-slate-300">Total Rp</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {laporanBulanan.map((row) => (
                      <tr key={row.monthKey} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold text-slate-900">{row.monthName}</td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.marketplace)} <span className="block text-xs mt-1">{row.marketplaceQty} pcs</span></td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.playbook)}</td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.tokoBuku)} <span className="block text-xs mt-1">{row.tokoBukuQty} pcs</span></td>
                        <td className="p-4 font-bold bg-slate-50 border-l border-slate-100">{formatRupiah(row.marketplace + row.playbook + row.tokoBuku)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'perJudul' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800">Rincian Penjualan Berdasarkan Judul</h2>
                <select value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)} className="bg-white border border-slate-300 text-sm rounded-lg p-2.5 shadow-sm">
                  {daftarBulan.map((bulan) => (<option key={bulan.key} value={bulan.key}>{bulan.name}</option>))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-100 text-slate-600 text-sm uppercase">
                    <th className="p-4 font-bold">Judul Buku</th><th className="p-4 font-bold">Marketplace</th><th className="p-4 font-bold">Playbook</th><th className="p-4 font-bold">Toko Buku</th><th className="p-4 font-bold bg-slate-200 border-l border-slate-300">Pendapatan</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataJudulTampil.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-4 font-semibold text-slate-900 border-r border-slate-100"><span className="block text-xs font-mono text-slate-400 mb-1">{row.itemCode}</span>{row.judulItem}</td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.marketplace)} <span className="block text-xs mt-1 text-slate-400">{row.marketplaceQty} pcs</span></td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.playbook)}</td>
                        <td className="p-4 text-slate-600">{formatRupiah(row.tokoBuku)} <span className="block text-xs mt-1 text-slate-400">{row.tokoBukuQty} pcs</span></td>
                        <td className="p-4 font-bold bg-slate-50 border-l border-slate-100">{formatRupiah(row.marketplace + row.playbook + row.tokoBuku)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'royalti' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <div className="px-6 py-5 border-b border-indigo-100 bg-indigo-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-indigo-900">Perhitungan Estimasi Royalti</h2>
                    <p className="text-sm text-indigo-700 mt-1">Dihitung otomatis berdasarkan tarif Fisik dan Playbook dari Data Master.</p>
                </div>
                
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <label className="text-sm font-semibold text-indigo-700 uppercase tracking-wider whitespace-nowrap">Filter Periode:</label>
                  <select 
                    value={selectedPeriode} 
                    onChange={(e) => setSelectedPeriode(e.target.value)}
                    className="bg-white border border-indigo-300 text-indigo-900 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block w-full p-2.5 font-bold cursor-pointer shadow-sm hover:bg-indigo-50 transition-colors"
                  >
                    {daftarPeriode.map((periode, idx) => (
                      <option key={idx} value={periode}>{periode === 'Semua' ? 'Semua Waktu' : periode}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-r border-slate-200">Judul Buku</th>
                      <th className="p-4 font-bold bg-amber-50">Omzet Fisik (Rp)</th>
                      <th className="p-4 font-bold bg-amber-50 border-r border-slate-200">Estimasi Royalti Fisik</th>
                      <th className="p-4 font-bold bg-emerald-50">Omzet Playbook (Rp)</th>
                      <th className="p-4 font-bold bg-emerald-50 border-r border-slate-200">Estimasi Royalti Digital</th>
                      <th className="p-4 font-bold bg-indigo-100 text-indigo-900">Total Royalti Dibayarkan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataRoyaltiTampil.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 bg-white">
                          Tidak ada transaksi yang tercatat pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      dataRoyaltiTampil.map((row: any, idx: number) => {
                        const totalRoyalti = row.royaltiFisik + row.royaltiPlaybook;
                        if (row.jualFisik === 0 && row.jualPlaybook === 0) return null;
                        
                        return (
                          <tr key={row.itemCode || idx} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="p-4 font-semibold text-slate-900 border-r border-slate-100 w-64">
                              <span className="block text-xs font-mono text-slate-400 font-normal mb-1">{row.itemCode}</span>
                              {row.judulItem}
                            </td>
                            {/* FISIK */}
                            <td className="p-4 text-slate-600 bg-amber-50/30">{formatRupiah(row.jualFisik)}</td>
                            <td className="p-4 border-r border-slate-100 bg-amber-50/50">
                                <span className="block text-slate-800 font-semibold">{formatRupiah(row.royaltiFisik)}</span>
                                <span className="block text-xs text-amber-700 mt-1">Tarif: {(row.persentaseFisik * 100).toFixed(1).replace('.0', '')}%</span>
                            </td>
                            {/* DIGITAL */}
                            <td className="p-4 text-slate-600 bg-emerald-50/30">{formatRupiah(row.jualPlaybook)}</td>
                            <td className="p-4 border-r border-slate-100 bg-emerald-50/50">
                                <span className="block text-slate-800 font-semibold">{formatRupiah(row.royaltiPlaybook)}</span>
                                <span className="block text-xs text-emerald-700 mt-1">Tarif: {(row.persentasePlaybook * 100).toFixed(1).replace('.0', '')}%</span>
                            </td>
                            {/* TOTAL */}
                            <td className="p-4 font-bold text-indigo-700 bg-indigo-50/50 align-middle text-lg">
                              {formatRupiah(totalRoyalti)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {dataRoyaltiTampil.length > 0 && (
                      <tfoot>
                          <tr className="bg-indigo-900 text-white">
                              <td className="p-4 font-bold text-right" colSpan={5}>GRAND TOTAL ESTIMASI ROYALTI PERIODE INI:</td>
                              <td className="p-4 font-bold text-xl text-indigo-200">
                                  {formatRupiah(dataRoyaltiTampil.reduce((acc: number, curr: any) => acc + curr.royaltiFisik + curr.royaltiPlaybook, 0))}
                              </td>
                          </tr>
                      </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}