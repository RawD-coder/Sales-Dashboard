'use client'
import { useEffect, useState } from 'react';

export default function LaporanPenjualan() {
  const [laporanBulanan, setLaporanBulanan] = useState([]);
  const [grandTotal, setGrandTotal] = useState({ marketplace: 0, playbook: 0, tokoBuku: 0 });
  const [loading, setLoading] = useState(true);

  // === ⚠️ SESUAIKAN DENGAN NAMA KOLOM DI SPREADSHEET ANDA ⚠️ ===
  const NAMA_KOLOM_TANGGAL = 'Tanggal';    // Contoh: 'Date', 'Waktu', 'Tanggal Transaksi'
  const NAMA_KOLOM_PENJUALAN = 'Total';    // Contoh: 'Harga', 'Nominal', 'Subtotal', 'Total Bayar'

  // Fungsi untuk memformat angka menjadi format Rupiah
  const formatRupiah = (angka) => {
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

        const rekap = {};
        const totalKeseluruhan = { marketplace: 0, playbook: 0, tokoBuku: 0 };

        // Fungsi untuk memproses dan menjumlahkan nominal per bulan
        const prosesData = (sumberData, namaSumber) => {
          sumberData.forEach(item => {
            const tanggalMentah = item[NAMA_KOLOM_TANGGAL] || item['Date'] || item['tanggal'];
            if (!tanggalMentah) return; 

            // 1. Parsing Tanggal
            let dateObj;
            if (typeof tanggalMentah === 'string' && tanggalMentah.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
                const parts = tanggalMentah.split(/[-/]/);
                dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                dateObj = new Date(tanggalMentah);
            }
            if (isNaN(dateObj)) return;

            // 2. Parsing Nominal Penjualan
            // Ambil data teks, bersihkan dari 'Rp', titik, dan koma, lalu ubah jadi angka murni
            let nilaiMentah = item[NAMA_KOLOM_PENJUALAN] || item['Harga'] || item['Penjualan'] || "0";
            if (typeof nilaiMentah === 'string') {
              // Hapus semua karakter selain angka
              nilaiMentah = nilaiMentah.replace(/[^0-9]/g, '');
            }
            const nilaiPenjualan = parseInt(nilaiMentah, 10) || 0;

            const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

            if (!rekap[monthKey]) {
              rekap[monthKey] = { monthKey, monthName, marketplace: 0, playbook: 0, tokoBuku: 0 };
            }
            
            // 3. Tambahkan nominal ke bulan terkait dan ke Grand Total
            rekap[monthKey][namaSumber] += nilaiPenjualan;
            totalKeseluruhan[namaSumber] += nilaiPenjualan;
          });
        };

        prosesData(result.marketplace || [], 'marketplace');
        prosesData(result.playbook || [], 'playbook');
        prosesData(result.tokoBuku || [], 'tokoBuku');

        const dataTerurut = Object.values(rekap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        
        setLaporanBulanan(dataTerurut);
        setGrandTotal(totalKeseluruhan);

      } catch (error) {
        console.error("Gagal memuat laporan", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-10 text-xl font-bold flex items-center justify-center min-h-screen">Memuat Data Penjualan...</div>;

  return (
    <div className="min-h-screen p-8 bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-slate-900">Dashboard Laporan Penjualan</h1>
        
        {/* Ringkasan Grand Total Penjualan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 bg-blue-100 rounded-xl border border-blue-200 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900 mb-1">Total Penjualan Marketplace</h2>
            <p className="text-2xl md:text-3xl font-bold text-blue-700">{formatRupiah(grandTotal.marketplace)}</p>
          </div>
          <div className="p-6 bg-emerald-100 rounded-xl border border-emerald-200 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900 mb-1">Total Penjualan Playbook</h2>
            <p className="text-2xl md:text-3xl font-bold text-emerald-700">{formatRupiah(grandTotal.playbook)}</p>
          </div>
          <div className="p-6 bg-amber-100 rounded-xl border border-amber-200 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900 mb-1">Total Penjualan Toko Buku</h2>
            <p className="text-2xl md:text-3xl font-bold text-amber-700">{formatRupiah(grandTotal.tokoBuku)}</p>
          </div>
        </div>

        {/* Tabel Laporan Bulanan */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">Rekapitulasi Penjualan Per Bulan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-slate-50">
                  <th className="p-4 whitespace-nowrap">Bulan & Tahun</th>
                  <th className="p-4 whitespace-nowrap">Marketplace</th>
                  <th className="p-4 whitespace-nowrap">Playbook</th>
                  <th className="p-4 whitespace-nowrap">Toko Buku</th>
                  <th className="p-4 whitespace-nowrap border-l border-slate-600 bg-slate-900">Total Keseluruhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {laporanBulanan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 bg-slate-50">
                      Gagal menghitung data. Pastikan variabel <b>NAMA_KOLOM_TANGGAL</b> dan <b>NAMA_KOLOM_PENJUALAN</b> sesuai dengan judul kolom di Spreadsheet Anda.
                    </td>
                  </tr>
                ) : (
                  laporanBulanan.map((row) => {
                    const totalPerBulan = row.marketplace + row.playbook + row.tokoBuku;
                    return (
                      <tr key={row.monthKey} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-semibold text-slate-900">{row.monthName}</td>
                        <td className="p-4 text-slate-700">{formatRupiah(row.marketplace)}</td>
                        <td className="p-4 text-slate-700">{formatRupiah(row.playbook)}</td>
                        <td className="p-4 text-slate-700">{formatRupiah(row.tokoBuku)}</td>
                        <td className="p-4 font-bold text-slate-900 border-l border-slate-200 bg-slate-50">
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