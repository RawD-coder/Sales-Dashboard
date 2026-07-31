// app/api/sales/route.js
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

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

    // Menarik data dari masing-masing sheet
    const [marketplace, playbook, tokoBuku] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Marketplace!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Playbook!A:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Trx_Trx_Toko_Buku!A:Z' }),
    ]);

    // Fungsi untuk memformat array 2D dari API menjadi array of objects
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

    return NextResponse.json({
      marketplace: formatData(marketplace),
      playbook: formatData(playbook),
      tokoBuku: formatData(tokoBuku),
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Gagal mengambil data dari Spreadsheet' }, { status: 500 });
  }
}