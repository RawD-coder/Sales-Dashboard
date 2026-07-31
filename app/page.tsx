'use client'
import { useEffect, useState } from 'react';

export default function LaporanPenjualan() {
  // Tambahan <any[]> agar TypeScript tahu ini berisi kumpulan data
  const [laporanBulanan, setLaporanBulanan] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState({ marketplace: 0, playbook: 0, tokoBuku: 0 });
  const [loading, setLoading] = useState(true);

  const NAMA_KOLOM_TANGGAL = 'Tanggal'; 
  const NAMA_KOLOM_PENJUALAN = 'Total'; 

  // Tambahan tipe data (angka: number)
  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(angka);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/sales');
        const result = await res.json();

        // Tambahan Record<string, any> untuk TypeScript
        const rekap: Record<string, any> = {};
        const totalKeseluruhan: Record<string, number> = { marketplace: 0, playbook: 0, tokoBuku: 0 };

        // Tambahan tipe data (sumberData: any[], namaSumber: string)
        const prosesData = (sumberData: any[], namaSumber: string) => {
          sumberData.forEach((item: any) => {
            const tanggalMentah = item[NAMA_KOLOM_TANGGAL] || item['Date'] || item['tanggal'];
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
            
            if (cekFormatAngka) {
                dateObj = new Date(`${cekFormatAngka[3]}-${cekFormatAngka[2].padStart(2,'0')}-${cekFormatAngka[1].padStart(2,'0')}T00:00:00`);
            } else {
                dateObj = new Date(bersihTanggal);
            }

            // Tambahan .getTime() agar TS tidak error
            if (isNaN(dateObj.getTime())) {
              console.warn("Format tanggal tidak dikenali:", tanggalMentah);
              return; 
            }

            let nilaiMentah = item[NAMA_KOLOM_PENJUALAN] || item['Harga'] || item['Penjualan'] || "0";
            if (typeof nilaiMentah === 'string') {
              nilaiMentah = nilaiMentah.replace(/[^0-9]/g, '');
            }
            const nilaiPenjualan = parseInt(nilaiMentah, 10) || 0;

            const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

            if (!rekap[monthKey]) {
              rekap[monthKey] = { monthKey, monthName, marketplace: 0, playbook: 0, tokoBuku: 0 };
            }
            
            rekap[monthKey][namaSumber] += nilaiPenjualan;
            totalKeseluruhan[namaSumber] += nilaiPenjualan;
          });
        };

        prosesData(result.marketplace || [], 'marketplace');
        prosesData(result.playbook || [], 'playbook');
        prosesData(result.tokoBuku || [], 'tokoBuku');

        // INI BAGIAN YANG ERROR TADI: Tambahan (a: any, b: any) memecahkan masalahnya
        const dataTerurut = Object.values(rekap).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey));
        
        setLaporanBulanan(dataTerurut);
        setGrandTotal({
          marketplace: totalKeseluruhan.marketplace,
          playbook: totalKeseluruhan.playbook,
          tokoBuku: totalKeseluruhan.tokoBuku
        });

      } catch (error) {
        console.error("Gagal memuat laporan", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-xl font-bold flex items-center justify-center min-h-screen">Memuat Data Penjualan...</div>;

  const totalSemuaPendapatan = grandTotal.marketplace + grandTotal.playbook + grandTotal.tokoBuku;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-slate-900">Dashboard Laporan Penjualan</h1>
        
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 mb-8 shadow-lg text-white">
          <h2 className="text-lg md:text-xl font-medium text-slate-300 mb-2">Total Keseluruhan Pendapatan</h2>
          <p className="text-4xl md:text-6xl font-bold tracking-tight">
            {formatRupiah(totalSemuaPendapatan)}
          </p>
          <p className="text-slate-400 mt-2 text-sm">
            Akumulasi penjualan dari Marketplace, Playbook, dan Toko Buku.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-blue-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Marketplace</h2>
            <p className="text-2xl md:text-3xl font-bold text-slate-800">{formatRupiah(grandTotal.marketplace)}</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-emerald-200 shadow-sm border-l-4 border-l-emerald-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Playbook</h2>
            <p className="text-2xl md:text-3xl font-bold text-slate-800">{formatRupiah(grandTotal.playbook)}</p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-amber-200 shadow-sm border-l-4 border-l-amber-500">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Toko Buku</h2>
            <p className="text-2xl md:text-3xl font-bold text-slate-800">{formatRupiah(grandTotal.tokoBuku)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Rekapitulasi Penjualan Per Bulan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="p-4 whitespace-nowrap font-bold">Bulan & Tahun</th>
                  <th className="p-4 whitespace-nowrap font-bold">Marketplace</th>
                  <th className="p-4 whitespace-nowrap font-bold">Playbook</th>
                  <th className="p-4 whitespace-nowrap font-bold">Toko Buku</th>
                  <th className="p-4 whitespace-nowrap border-l border-slate-200 bg-slate-200 font-bold text-slate-800">Total Per Bulan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {laporanBulanan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 bg-white">
                      Belum ada data penjualan atau sedang diproses.
                    </td>
                  </tr>
                ) : (
                  laporanBulanan.map((row) => {
                    const totalPerBulan = row.marketplace + row.playbook + row.tokoBuku;
                    return (
                      <tr key={row.monthKey} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 font-semibold text-slate-900">{row.monthName}</td>
                        <td className="p-4 text-slate-600 font-medium">{formatRupiah(row.marketplace)}</td>
                        <td className="p-4 text-slate-600 font-medium">{formatRupiah(row.playbook)}</td>
                        <td className="p-4 text-slate-600 font-medium">{formatRupiah(row.tokoBuku)}</td>
                        <td className="p-4 font-bold text-slate-900 border-l border-slate-100 bg-slate-50/50">
                          {formatRupiah(totalPerBulan)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}