'use client'
import { useEffect, useState } from 'react';

export default function LaporanPenjualan() {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'perJudul' | 'royalti'>('ringkasan');
  
  const [laporanBulanan, setLaporanBulanan] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState({ marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0, playbookQty: 0 });
  
  const [dataPerJudulMentah, setDataPerJudulMentah] = useState<Record<string, any>>({});
  const [daftarBulan, setDaftarBulan] = useState<{key: string, name: string}[]>([]);
  const [selectedBulan, setSelectedBulan] = useState<string>('Semua');

  const [dataRoyaltiMentah, setDataRoyaltiMentah] = useState<Record<string, any>>({});
  const [daftarPeriode, setDaftarPeriode] = useState<string[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('Semua');

  const [loading, setLoading] = useState(true);

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  // Fungsi memicu dialog Print / Save as PDF browser
  const handlePrintPDF = () => {
    window.print();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timestamp = new Date().getTime();
        const res = await fetch(`/api/sales?t=${timestamp}`, { cache: 'no-store' });
        const result = await res.json();

        const masterMap: Record<string, { royaltiFisik: number, royaltiPlaybook: number }> = {};
        
        // 1. MEMBACA DATA MASTER ITEM
        (result.master || []).forEach((row: any) => {
          let valFisik: any = 0;
          let valPlaybook: any = 0;
          let codeKey = '';
          let titleKey = '';
          
          Object.keys(row).forEach(k => {
             const cleanK = k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
             if (cleanK.includes('fisik')) valFisik = row[k];
             if (cleanK.includes('playbook') || cleanK.includes('digital')) valPlaybook = row[k];
             if (cleanK.includes('itemcode') || cleanK.includes('kode')) codeKey = String(row[k]).trim().toUpperCase();
             if (cleanK.includes('desc') || cleanK.includes('judul')) titleKey = String(row[k]).trim().toUpperCase();
          });

          const parsePercent = (val: any) => {
            if (!val || val === '') return 0;
            const strVal = String(val).trim().toLowerCase();
            let clean = strVal.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
            let num = parseFloat(clean);
            if (isNaN(num)) return 0;
            if (strVal.includes('%')) return num / 100;
            if (num >= 1) return num / 100; 
            return num;
          };

          if (codeKey) masterMap[codeKey] = { royaltiFisik: parsePercent(valFisik), royaltiPlaybook: parsePercent(valPlaybook) };
          if (titleKey) masterMap[titleKey] = { royaltiFisik: parsePercent(valFisik), royaltiPlaybook: parsePercent(valPlaybook) };
        });

        const rekapBulanan: Record<string, any> = {};
        const rekapJudul: Record<string, any> = {}; 
        const rekapRoyalti: Record<string, any> = {}; 
        const totalKeseluruhan: Record<string, number> = { marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0, playbookQty: 0 };
        const opsiBulan: Record<string, string> = {}; 
        const opsiPeriode: Set<string> = new Set(); 

        // 2. MEMPROSES TRANSAKSI
        const prosesData = (sumberData: any[], namaSumber: string) => {
          sumberData.forEach((item: any) => {
            const tanggalMentah = item['Date'] || item['Tanggal'];
            if (!tanggalMentah) return; 

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

            let nilaiMentah = item['Total'] || "0";
            if (typeof nilaiMentah === 'string') nilaiMentah = nilaiMentah.split(',')[0].replace(/[^0-9]/g, ''); 
            const nilaiPenjualan = parseInt(nilaiMentah, 10) || 0;
            
            // Qty: Untuk Playbook (digital) otomatis dihitung 1 unit jika kolom Qty tidak ada
            const qtyItem = parseInt(item['Qty'], 10) || (namaSumber === 'playbook' ? 1 : 0);
            
            const itemCodeKey = String(item['Item_Code'] || '').trim().toUpperCase();
            const judulItemAsli = String(item['Description'] || 'Tanpa Judul').trim();
            const titleKey = judulItemAsli.toUpperCase();

            // LOGIKA HYBRID ROYALTI
            let nilaiRoyalti = 0;
            let sumberTarif = "Master";
            
            let nilaiKolomRoyalti: any = null;
            Object.keys(item).forEach(k => {
               const cleanK = k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
               if (cleanK.includes('royalt') || cleanK.includes('komisi') || cleanK.includes('fee')) {
                  if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
                     nilaiKolomRoyalti = item[k];
                  }
               }
            });

            if (nilaiKolomRoyalti !== null) {
               const strVal = String(nilaiKolomRoyalti).trim().toLowerCase().replace(/,/g, '.');
               let num = parseFloat(strVal.replace(/[^0-9.-]/g, ''));
               if (!isNaN(num) && num > 0) {
                  if (strVal.includes('%') || num <= 1) {
                     const rate = (strVal.includes('%') && num >= 1) ? num / 100 : num;
                     nilaiRoyalti = Math.round(nilaiPenjualan * rate);
                     sumberTarif = `Sheet (${Math.round(rate * 100)}%)`;
                  } else {
                     nilaiRoyalti = Math.round(num);
                     sumberTarif = "Sheet (Rupiah)";
                  }
               }
            }

            if (nilaiRoyalti === 0) {
               const tarifFisik = (masterMap[itemCodeKey]?.royaltiFisik) || (masterMap[titleKey]?.royaltiFisik) || 0;
               const tarifPlaybook = (masterMap[itemCodeKey]?.royaltiPlaybook) || (masterMap[titleKey]?.royaltiPlaybook) || 0;
               if (namaSumber === 'playbook') {
                  nilaiRoyalti = Math.round(nilaiPenjualan * tarifPlaybook);
                  sumberTarif = `Master (${Math.round(tarifPlaybook * 100)}%)`;
               } else {
                  nilaiRoyalti = Math.round(nilaiPenjualan * tarifFisik);
                  sumberTarif = `Master (${Math.round(tarifFisik * 100)}%)`;
               }
            }

            const m = dateObj.getMonth();
            const y = dateObj.getFullYear();
            let namaPeriode = "";
            if (m >= 0 && m <= 3) namaPeriode = `Januari - April ${y}`;
            else if (m >= 4 && m <= 7) namaPeriode = `Mei - Agustus ${y}`;
            else namaPeriode = `September - Desember ${y}`;

            const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const itemCodeTampil = itemCodeKey || '-'; 

            if (!rekapBulanan[monthKey]) {
              rekapBulanan[monthKey] = { monthKey, monthName, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0, playbookQty: 0 };
              opsiBulan[monthKey] = monthName; 
            }
            rekapBulanan[monthKey][namaSumber] += nilaiPenjualan;
            rekapBulanan[monthKey][namaSumber + 'Qty'] += qtyItem;
            totalKeseluruhan[namaSumber] += nilaiPenjualan;
            totalKeseluruhan[namaSumber + 'Qty'] += qtyItem;

            if (!rekapJudul[monthKey]) rekapJudul[monthKey] = {};
            if (!rekapJudul[monthKey][itemCodeTampil]) {
              rekapJudul[monthKey][itemCodeTampil] = { itemCode: itemCodeTampil, judulItem: judulItemAsli, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0, playbookQty: 0 };
            }
            rekapJudul[monthKey][itemCodeTampil][namaSumber] += nilaiPenjualan;
            rekapJudul[monthKey][itemCodeTampil][namaSumber + 'Qty'] += qtyItem;

            if (!rekapJudul['Semua']) rekapJudul['Semua'] = {};
            if (!rekapJudul['Semua'][itemCodeTampil]) {
              rekapJudul['Semua'][itemCodeTampil] = { itemCode: itemCodeTampil, judulItem: judulItemAsli, marketplace: 0, playbook: 0, tokoBuku: 0, marketplaceQty: 0, tokoBukuQty: 0, playbookQty: 0 };
            }
            rekapJudul['Semua'][itemCodeTampil][namaSumber] += nilaiPenjualan;
            rekapJudul['Semua'][itemCodeTampil][namaSumber + 'Qty'] += qtyItem;

            opsiPeriode.add(namaPeriode);
            if (!rekapRoyalti[namaPeriode]) rekapRoyalti[namaPeriode] = {};
            if (!rekapRoyalti[namaPeriode][itemCodeTampil]) {
                rekapRoyalti[namaPeriode][itemCodeTampil] = { 
                    itemCode: itemCodeTampil, judulItem: judulItemAsli, 
                    jualFisik: 0, jualPlaybook: 0, royaltiFisik: 0, royaltiPlaybook: 0, 
                    qtyFisik: 0, qtyPlaybook: 0,
                    infoFisik: '-', infoPlaybook: '-' 
                };
            }
            if (namaSumber === 'playbook') {
                rekapRoyalti[namaPeriode][itemCodeTampil].jualPlaybook += nilaiPenjualan;
                rekapRoyalti[namaPeriode][itemCodeTampil].royaltiPlaybook += nilaiRoyalti;
                rekapRoyalti[namaPeriode][itemCodeTampil].qtyPlaybook += qtyItem;
                rekapRoyalti[namaPeriode][itemCodeTampil].infoPlaybook = sumberTarif;
            } else {
                rekapRoyalti[namaPeriode][itemCodeTampil].jualFisik += nilaiPenjualan;
                rekapRoyalti[namaPeriode][itemCodeTampil].royaltiFisik += nilaiRoyalti;
                rekapRoyalti[namaPeriode][itemCodeTampil].qtyFisik += qtyItem;
                rekapRoyalti[namaPeriode][itemCodeTampil].infoFisik = sumberTarif;
            }

            if (!rekapRoyalti['Semua']) rekapRoyalti['Semua'] = {};
            if (!rekapRoyalti['Semua'][itemCodeTampil]) {
                rekapRoyalti['Semua'][itemCodeTampil] = { 
                    itemCode: itemCodeTampil, judulItem: judulItemAsli, 
                    jualFisik: 0, jualPlaybook: 0, royaltiFisik: 0, royaltiPlaybook: 0, 
                    qtyFisik: 0, qtyPlaybook: 0,
                    infoFisik: '-', infoPlaybook: '-' 
                };
            }
            if (namaSumber === 'playbook') {
                rekapRoyalti['Semua'][itemCodeTampil].jualPlaybook += nilaiPenjualan;
                rekapRoyalti['Semua'][itemCodeTampil].royaltiPlaybook += nilaiRoyalti;
                rekapRoyalti['Semua'][itemCodeTampil].qtyPlaybook += qtyItem;
                rekapRoyalti['Semua'][itemCodeTampil].infoPlaybook = sumberTarif;
            } else {
                rekapRoyalti['Semua'][itemCodeTampil].jualFisik += nilaiPenjualan;
                rekapRoyalti['Semua'][itemCodeTampil].royaltiFisik += nilaiRoyalti;
                rekapRoyalti['Semua'][itemCodeTampil].qtyFisik += qtyItem;
                rekapRoyalti['Semua'][itemCodeTampil].infoFisik = sumberTarif;
            }
          });
        };

        prosesData(result.marketplace || [], 'marketplace');
        prosesData(result.playbook || [], 'playbook');
        prosesData(result.tokoBuku || [], 'tokoBuku');

        setLaporanBulanan(Object.values(rekapBulanan).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey)));
        const arrBulan = Object.keys(opsiBulan).sort((a, b) => b.localeCompare(a)).map(k => ({ key: k, name: opsiBulan[k] }));
        setDaftarBulan([{key: 'Semua', name: 'Semua Waktu'}, ...arrBulan]);
        setDaftarPeriode(['Semua', ...Array.from(opsiPeriode).sort().reverse()]);
        setDataPerJudulMentah(rekapJudul);
        setDataRoyaltiMentah(rekapRoyalti);
        setGrandTotal({
          marketplace: totalKeseluruhan.marketplace, playbook: totalKeseluruhan.playbook, tokoBuku: totalKeseluruhan.tokoBuku,
          marketplaceQty: totalKeseluruhan.marketplaceQty, tokoBukuQty: totalKeseluruhan.tokoBukuQty, playbookQty: totalKeseluruhan.playbookQty
        });

      } catch (error) {
        console.error("Gagal memuat laporan", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-xl font-bold flex items-center justify-center min-h-screen text-indigo-700">Memuat Data Penjualan & Royalti...</div>;

  const totalSemuaPendapatan = grandTotal.marketplace + grandTotal.playbook + grandTotal.tokoBuku;
  const dataJudulTampil = dataPerJudulMentah[selectedBulan] ? Object.values(dataPerJudulMentah[selectedBulan]).sort((a: any, b: any) => (b.marketplace + b.playbook + b.tokoBuku) - (a.marketplace + a.playbook + a.tokoBuku)) : [];
  const dataRoyaltiTampil = dataRoyaltiMentah[selectedPeriode] ? Object.values(dataRoyaltiMentah[selectedPeriode]).sort((a: any, b: any) => (b.royaltiFisik + b.royaltiPlaybook) - (a.royaltiFisik + a.royaltiPlaybook)) : [];

  const teksBulanTerpilih = daftarBulan.find(b => b.key === selectedBulan)?.name || 'Semua Waktu';
  const teksPeriodeTerpilih = selectedPeriode === 'Semua' ? 'Semua Waktu' : selectedPeriode;

  // KOMPONEN KOP SURAT ATAS (Hanya Muncul Saat Cetak / Print PDF)
  const KopSuratAtas = () => (
    <div className="hidden print:block mb-6 border-b-4 border-double border-slate-900 pb-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-widest text-slate-900 uppercase font-serif">
            RDM PUBLISHERS
          </h1>
          <p className="text-sm font-bold text-slate-700 tracking-wide">
            PT. MD PUBLIKASI INDONESIA
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold bg-slate-900 text-white px-3 py-1 rounded">
            DOKUMEN RESMI
          </span>
          <p className="text-[11px] text-slate-500 mt-1">
            Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );

  // KOMPONEN KOP SURAT BAWAH / FOOTER (Hanya Muncul Saat Cetak / Print PDF)
  const KopSuratBawah = () => (
    <div className="hidden print:block mt-8 pt-4 border-t-2 border-slate-800 text-center text-[10px] text-slate-600 leading-relaxed">
      <p className="font-bold text-slate-900 uppercase">PT. MD PUBLIKASI INDONESIA</p>
      <p>MD Place, Jln. Setia Budi Selatan No.7, Jakarta Selatan, 12910 | WWW.RDMPUBLISHERS.COM</p>
      <p>Phone: 298 55 777. Fax: 290 33 777 | Instagram / Twitter / Telegram: @RDMPUBLISHERS</p>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans">
      
      {/* ========================================================================= */}
      {/* STYLING CETAK A4 (PAGE BREAK PROTECTED)                                   */}
      {/* ========================================================================= */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 7px 9px !important;
            font-size: 10.5px !important;
          }
        }
      `}</style>

      <div className="max-w-[90rem] mx-auto">
        
        {/* HEADER WEBSITE (Sembunyi saat dicetak) */}
        <div className="no-print">
          <h1 className="text-3xl font-bold mb-6 text-slate-900">Dashboard Laporan Penjualan</h1>
          
          <div className="flex space-x-2 md:space-x-4 mb-8 bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-flex w-full md:w-auto overflow-x-auto">
            <button onClick={() => setActiveTab('ringkasan')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'ringkasan' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Ringkasan Bulanan</button>
            <button onClick={() => setActiveTab('perJudul')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'perJudul' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Detail Per Judul Buku</button>
            <button onClick={() => setActiveTab('royalti')} className={`px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap ${activeTab === 'royalti' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Laporan Royalti (Bagi Hasil)</button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: RINGKASAN BULANAN                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'ringkasan' && (
          <div className="animate-in fade-in duration-500 no-print">
             <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 mb-8 shadow-lg text-white">
              <h2 className="text-lg md:text-xl font-medium text-slate-300 mb-2">Total Keseluruhan Pendapatan</h2>
              <p className="text-4xl md:text-6xl font-bold tracking-tight">{formatRupiah(totalSemuaPendapatan)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="p-6 bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-blue-500">
                <h2 className="text-sm font-bold uppercase text-slate-500 mb-1">Marketplace</h2>
                <p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.marketplace)}</p>
                <span className="text-sm font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full mt-4 inline-block">{grandTotal.marketplaceQty} Unit Terjual</span>
              </div>
              <div className="p-6 bg-white rounded-xl border border-emerald-200 shadow-sm border-l-4 border-l-emerald-500">
                <h2 className="text-sm font-bold uppercase text-slate-500 mb-1">Playbook (Digital)</h2>
                <p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.playbook)}</p>
                <span className="text-sm font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mt-4 inline-block">{grandTotal.playbookQty} Unit Terjual</span>
              </div>
              <div className="p-6 bg-white rounded-xl border border-amber-200 shadow-sm border-l-4 border-l-amber-500">
                <h2 className="text-sm font-bold uppercase text-slate-500 mb-1">Toko Buku</h2>
                <p className="text-2xl font-bold text-slate-800">{formatRupiah(grandTotal.tokoBuku)}</p>
                <span className="text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full mt-4 inline-block">{grandTotal.tokoBukuQty} Unit Terjual</span>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-100 text-slate-600 text-sm uppercase">
                    <th className="p-4 font-bold">Bulan & Tahun</th><th className="p-4 font-bold">Marketplace</th><th className="p-4 font-bold">Playbook</th><th className="p-4 font-bold">Toko Buku</th><th className="p-4 font-bold bg-slate-200">Total Rp</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {laporanBulanan.map((row) => (
                    <tr key={row.monthKey} className="hover:bg-slate-50">
                      <td className="p-4 font-semibold">{row.monthName}</td>
                      <td className="p-4">{formatRupiah(row.marketplace)} <span className="block text-xs text-slate-400">{row.marketplaceQty} pcs</span></td>
                      <td className="p-4">{formatRupiah(row.playbook)} <span className="block text-xs text-slate-400">{row.playbookQty} pcs</span></td>
                      <td className="p-4">{formatRupiah(row.tokoBuku)} <span className="block text-xs text-slate-400">{row.tokoBukuQty} pcs</span></td>
                      <td className="p-4 font-bold bg-slate-50">{formatRupiah(row.marketplace + row.playbook + row.tokoBuku)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DETAIL PER JUDUL BUKU (DENGAN EXPORT / PRINT PDF & KOP TEKS)       */}
        {/* ========================================================================= */}
        {activeTab === 'perJudul' && (
          <div className="animate-in fade-in duration-500">
             
             {/* KOP SURAT TEKS (MUNCUL SAAT DICETAK) */}
             <KopSuratAtas />

             {/* JUDUL CETAK RESMI PADA DOKUMEN PDF */}
             <div className="hidden print:block mb-6 text-center border-b border-slate-300 pb-3">
               <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">Laporan Rincian Penjualan Buku</h2>
               <p className="text-sm font-semibold text-slate-700 mt-1">Periode: {teksBulanTerpilih}</p>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8 print:shadow-none print:border-none">
              <div className="px-6 py-5 border-b bg-slate-50 flex flex-wrap justify-between items-center gap-4 no-print">
                <h2 className="text-xl font-bold text-slate-800">Rincian Penjualan Berdasarkan Judul</h2>
                
                <div className="flex items-center space-x-3">
                  <select value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)} className="border rounded-lg p-2 text-sm bg-white font-medium">
                    {daftarBulan.map((bulan) => (<option key={bulan.key} value={bulan.key}>{bulan.name}</option>))}
                  </select>

                  <button 
                    onClick={handlePrintPDF}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    🖨️ Simpan / Print PDF
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-100 text-slate-600 text-sm uppercase">
                  <th className="p-4 font-bold">Judul Buku</th><th className="p-4 font-bold">Marketplace</th><th className="p-4 font-bold">Playbook</th><th className="p-4 font-bold">Toko Buku</th><th className="p-4 font-bold bg-slate-200">Pendapatan</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {dataJudulTampil.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 font-semibold"><span className="block text-xs font-mono text-slate-400">{row.itemCode}</span>{row.judulItem}</td>
                      <td className="p-4">{formatRupiah(row.marketplace)} <span className="block text-xs mt-1 text-slate-500">{row.marketplaceQty} pcs</span></td>
                      <td className="p-4">{formatRupiah(row.playbook)} <span className="block text-xs mt-1 text-slate-500">{row.playbookQty} pcs</span></td>
                      <td className="p-4">{formatRupiah(row.tokoBuku)} <span className="block text-xs mt-1 text-slate-500">{row.tokoBukuQty} pcs</span></td>
                      <td className="p-4 font-bold bg-slate-50">
                        {formatRupiah(row.marketplace + row.playbook + row.tokoBuku)}
                        <span className="block text-xs font-normal text-blue-700 mt-1">Total {row.marketplaceQty + row.playbookQty + row.tokoBukuQty} Unit</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FOOTER KOP SURAT TEKS (MUNCUL SAAT DICETAK) */}
            <KopSuratBawah />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LAPORAN ROYALTI (DENGAN EXPORT / PRINT PDF & KOP TEKS)             */}
        {/* ========================================================================= */}
        {activeTab === 'royalti' && (
          <div className="animate-in fade-in duration-500">
            
            {/* KOP SURAT TEKS (MUNCUL SAAT DICETAK) */}
            <KopSuratAtas />

            {/* JUDUL CETAK RESMI PADA DOKUMEN PDF */}
            <div className="hidden print:block mb-6 text-center border-b border-slate-300 pb-3">
               <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">Laporan Perhitungan Estimasi Royalti</h2>
               <p className="text-sm font-semibold text-slate-700 mt-1">Periode: {teksPeriodeTerpilih}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8 print:shadow-none print:border-none">
              <div className="px-6 py-5 border-b border-indigo-100 bg-indigo-50 flex flex-wrap justify-between items-center gap-4 no-print">
                <div>
                    <h2 className="text-xl font-bold text-indigo-900">Perhitungan Estimasi Royalti</h2>
                    <p className="text-sm text-indigo-700">Dilengkapi rincian Qty terjual untuk bukti bagi hasil penulis.</p>
                </div>

                <div className="flex items-center space-x-3">
                  <select value={selectedPeriode} onChange={(e) => setSelectedPeriode(e.target.value)} className="border border-indigo-300 rounded-lg p-2.5 bg-white text-sm font-bold">
                    {daftarPeriode.map((periode, idx) => (<option key={idx} value={periode}>{periode === 'Semua' ? 'Semua Waktu' : periode}</option>))}
                  </select>

                  <button 
                    onClick={handlePrintPDF}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    🖨️ Simpan / Print PDF
                  </button>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                    <th className="p-4 font-bold">Judul Buku</th>
                    <th className="p-4 font-bold bg-amber-50">Omzet Fisik (Rp)</th>
                    <th className="p-4 font-bold bg-amber-50">Royalti Fisik</th>
                    <th className="p-4 font-bold bg-emerald-50">Omzet Playbook (Rp)</th>
                    <th className="p-4 font-bold bg-emerald-50">Royalti Digital</th>
                    <th className="p-4 font-bold bg-indigo-100 text-indigo-900">Total Royalti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataRoyaltiTampil.map((row: any, idx: number) => {
                    const totalRoyalti = row.royaltiFisik + row.royaltiPlaybook;
                    const totalQty = row.qtyFisik + row.qtyPlaybook;
                    if (row.jualFisik === 0 && row.jualPlaybook === 0) return null;
                    
                    return (
                      <tr key={idx} className="hover:bg-indigo-50/30">
                        <td className="p-4 font-semibold">
                          <span className="block text-xs font-mono text-slate-400">{row.itemCode}</span>
                          {row.judulItem}
                          <span className="inline-block mt-1.5 px-2 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-700 rounded">
                            📦 Total {totalQty} Terjual
                          </span>
                        </td>
                        
                        {/* OMZET & QTY FISIK */}
                        <td className="p-4 bg-amber-50/30">
                          {formatRupiah(row.jualFisik)}
                          <span className="block text-xs font-semibold text-amber-800 mt-1">🏷️ {row.qtyFisik} pcs fisik</span>
                        </td>
                        <td className="p-4 bg-amber-50/50">
                          <span className="block font-semibold text-slate-800">{formatRupiah(row.royaltiFisik)}</span>
                          <span className="block text-[11px] text-amber-700 mt-0.5">Sumber: {row.infoFisik}</span>
                        </td>
                        
                        {/* OMZET & QTY PLAYBOOK */}
                        <td className="p-4 bg-emerald-50/30">
                          {formatRupiah(row.jualPlaybook)}
                          <span className="block text-xs font-semibold text-emerald-800 mt-1">📱 {row.qtyPlaybook} e-book digital</span>
                        </td>
                        <td className="p-4 bg-emerald-50/50">
                          <span className="block font-semibold text-slate-800">{formatRupiah(row.royaltiPlaybook)}</span>
                          <span className="block text-[11px] text-emerald-700 mt-0.5">Sumber: {row.infoPlaybook}</span>
                        </td>
                        
                        {/* TOTAL ROYALTI */}
                        <td className="p-4 bg-indigo-50/50 font-bold text-indigo-700 text-lg">
                          {formatRupiah(totalRoyalti)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {dataRoyaltiTampil.length > 0 && (
                  <tfoot>
                      <tr className="bg-indigo-900 text-white">
                          <td className="p-4 font-bold text-right" colSpan={5}>
                            GRAND TOTAL ESTIMASI ROYALTI ({teksPeriodeTerpilih}):
                          </td>
                          <td className="p-4 font-bold text-xl text-indigo-200">
                              {formatRupiah(dataRoyaltiTampil.reduce((acc: number, curr: any) => acc + curr.royaltiFisik + curr.royaltiPlaybook, 0))}
                          </td>
                      </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* FOOTER KOP SURAT TEKS (MUNCUL SAAT DICETAK) */}
            <KopSuratBawah />
          </div>
        )}

      </div>
    </div>
  );
}