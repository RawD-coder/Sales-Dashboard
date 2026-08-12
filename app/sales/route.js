import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const [master, marketplace, playbook, tokoBuku] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Master_Item!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Marketplace!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Playbook!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Toko_Buku!A:Z' }),
    ]);

    const formatData = (sheetData) => {
      const rows = sheetData.data.values || [];
      if (rows.length === 0) return [];
      const headers = rows[0];
      return rows.slice(1).map(row => {
        let obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    };

    const masterRows = formatData(master);
    const marketplaceRows = formatData(marketplace);
    const playbookRows = formatData(playbook);
    const tokoBukuRows = formatData(tokoBuku);

    // 1. BUAT KAMUS MASTER (TARIF ROYALTI)
    const masterMap = {};
    masterRows.forEach(row => {
      const code = String(row['Item_Code'] || '').trim().toUpperCase();
      const parsePct = (val) => {
        if (!val) return 0;
        let clean = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
        let num = parseFloat(clean);
        if (isNaN(num)) return 0;
        if (String(val).includes('%') || num >= 1) return num / 100;
        return num;
      };

      masterMap[code] = {
        fisik: parsePct(row['Royalty_Fisik'] || row['Royalti_Fisik']),
        playbook: parsePct(row['Royalty_PlayBook'] || row['Royalti_Playbook'])
      };
    });

    // 2. FUNGSI HITUNG OTOMATIS DI SERVER
    const processRowsWithRoyalty = (rows, type) => {
      return rows.map(row => {
        const code = String(row['Item_Code'] || '').trim().toUpperCase();
        const tarif = masterMap[code] || { fisik: 0, playbook: 0 };
        
        let totalStr = String(row['Total'] || '0').split(',')[0].replace(/[^0-9]/g, '');
        let totalVal = parseInt(totalStr, 10) || 0;

        let royaltiVal = 0;
        let usedRate = 0;

        if (type === 'playbook') {
          usedRate = tarif.playbook;
          royaltiVal = Math.round(totalVal * tarif.playbook);
        } else {
          usedRate = tarif.fisik;
          royaltiVal = Math.round(totalVal * tarif.fisik);
        }

        return {
          ...row,
          Parsed_Total: totalVal,
          Royalty_Rate: usedRate,
          Calculated_Royalty: royaltiVal
        };
      });
    };

    const enrichedMarketplace = processRowsWithRoyalty(marketplaceRows, 'marketplace');
    const enrichedPlaybook = processRowsWithRoyalty(playbookRows, 'playbook');
    const enrichedTokoBuku = processRowsWithRoyalty(tokoBukuRows, 'tokoBuku');

    return NextResponse.json({
      master: masterRows,
      marketplace: enrichedMarketplace,
      playbook: enrichedPlaybook,
      tokoBuku: enrichedTokoBuku,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data dari Spreadsheet' }, { status: 500 });
  }
}