var SHEET_ID = '1HrMtXNo3AQcdDMNNcqv0o2Fl59NSSy1IfPR5aO5tm6s';
var TIMEZONE = 'Asia/Makassar';

var HEADERS = [
  'Timestamp',
  'Jam',
  'UID Kartu',
  'Nama Alat',
  'Status',
  'Keterangan',
  'Durasi Peminjaman',
  'Durasi Detik'
];

function doPost(e) {
  try {
    Logger.log(JSON.stringify(e));

    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput('ERROR: Tidak ada data POST')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    ensureHeaders(sheet);

    var data = JSON.parse(e.postData.contents);
    var d = new Date();
    var uid = String(data.uid || '').trim().toUpperCase();
    var status = String(data.status || '').trim().toUpperCase();
    var durasi = String(data.durasi || '').trim();
    var durasiDetik = Number(data.durasiDetik || 0);

    if (!durasi) {
      durasi = '-';
    }

    if (isReturnStatus(status) && (!durasiDetik || durasi === '-' || durasi === 'Tidak terdeteksi')) {
      var durasiInfo = hitungDurasiDariSheet(sheet, uid, d);
      if (durasiInfo.terdeteksi) {
        durasi = durasiInfo.durasi;
        durasiDetik = durasiInfo.durasiDetik;
      }
    }

    var rowData = [
      d,
      Utilities.formatDate(d, TIMEZONE, 'HH:mm:ss'),
      uid,
      data.alat || '',
      status,
      data.ket || '',
      durasi,
      durasiDetik || 0
    ];

    sheet.appendRow(rowData);

    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('ERROR: ' + error);

    return ContentService
      .createTextOutput('ERROR: ' + error)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function doGet(e) {
  try {
    var action = '';

    if (e && e.parameter && e.parameter.action) {
      action = String(e.parameter.action).trim().toLowerCase();
    }

    if (action === 'cekstatus') {
      return cekStatusTerakhir(e);
    }

    return ambilSemuaData(e);

  } catch (error) {
    Logger.log('ERROR doGet: ' + error);

    return jsonResponse({
      success: false,
      system: 'rfid',
      error: String(error),
      data: []
    });
  }
}

function cekStatusTerakhir(e) {
  var uidCari = '';

  if (e && e.parameter && e.parameter.uid) {
    uidCari = String(e.parameter.uid).trim().toUpperCase();
  }

  if (uidCari === '') {
    return jsonResponse({
      success: false,
      system: 'rfid',
      message: 'Parameter uid kosong',
      uid: '',
      lastStatus: 'DITOLAK',
      statusTerakhir: 'DITOLAK',
      bolehKembali: false
    });
  }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  ensureHeaders(sheet);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return jsonResponse({
      success: true,
      system: 'rfid',
      uid: uidCari,
      alat: '',
      lastStatus: 'BELUM_ADA_DATA',
      statusTerakhir: 'BELUM_ADA_DATA',
      bolehKembali: false,
      message: 'Spreadsheet belum memiliki data transaksi'
    });
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function(h) {
    return String(h).trim();
  });

  var idxTimestamp = headers.indexOf('Timestamp');
  var idxUID = headers.indexOf('UID Kartu');
  var idxAlat = headers.indexOf('Nama Alat');
  var idxStatus = headers.indexOf('Status');
  var idxKet = headers.indexOf('Keterangan');
  var idxJam = headers.indexOf('Jam');
  var idxDurasi = headers.indexOf('Durasi Peminjaman');
  var idxDurasiDetik = headers.indexOf('Durasi Detik');

  if (idxUID === -1 || idxStatus === -1) {
    return jsonResponse({
      success: false,
      system: 'rfid',
      uid: uidCari,
      lastStatus: 'DITOLAK',
      statusTerakhir: 'DITOLAK',
      bolehKembali: false,
      message: 'Header UID Kartu atau Status tidak ditemukan'
    });
  }

  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    var uidRow = String(row[idxUID] || '').trim().toUpperCase();

    if (uidRow === uidCari) {
      var namaAlat = idxAlat !== -1 ? String(row[idxAlat] || '').trim() : '';
      var status = String(row[idxStatus] || '').trim().toUpperCase();
      var ket = idxKet !== -1 ? String(row[idxKet] || '').trim() : '';
      var jam = idxJam !== -1 ? String(row[idxJam] || '').trim() : '';
      var timestamp = idxTimestamp !== -1 ? row[idxTimestamp] : '';
      var durasi = idxDurasi !== -1 ? String(row[idxDurasi] || '').trim() : '';
      var durasiDetik = idxDurasiDetik !== -1 ? Number(row[idxDurasiDetik] || 0) : 0;
      var bolehKembali = isBorrowStatus(status);

      return jsonResponse({
        success: true,
        system: 'rfid',
        uid: uidCari,
        alat: namaAlat,
        lastStatus: status,
        statusTerakhir: status,
        bolehKembali: bolehKembali,
        jam: jam,
        timestamp: formatDateValue(timestamp),
        ket: ket,
        durasi: durasi,
        durasiDetik: durasiDetik,
        row: i + 1,
        message: bolehKembali
          ? 'Barang sedang dipinjam dan boleh dikembalikan'
          : 'Barang tidak dalam status DIPINJAM'
      });
    }
  }

  return jsonResponse({
    success: true,
    system: 'rfid',
    uid: uidCari,
    alat: '',
    lastStatus: 'BELUM_PERNAH_DIPINJAM',
    statusTerakhir: 'BELUM_PERNAH_DIPINJAM',
    bolehKembali: false,
    message: 'UID belum pernah tercatat di Spreadsheet'
  });
}

function ambilSemuaData(e) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  ensureHeaders(sheet);
  var limit = 0;

  if (e && e.parameter && e.parameter.limit) {
    limit = Math.max(0, Number(e.parameter.limit) || 0);
  }

  if (sheet.getLastRow() === 0) {
    return jsonResponse({
      success: true,
      system: 'rfid',
      total: 0,
      data: []
    });
  }

  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return jsonResponse({
      success: true,
      system: 'rfid',
      total: 0,
      data: []
    });
  }

  var headers = values[0].map(function(header) {
    return String(header).trim();
  });

  var bodyRows = values.slice(1);
  var totalRows = bodyRows.filter(function(row) {
    return row.some(function(cell) {
      return cell !== '';
    });
  }).length;

  if (limit > 0) {
    bodyRows = bodyRows.slice(-limit);
  }

  var data = bodyRows
    .filter(function(row) {
      return row.some(function(cell) {
        return cell !== '';
      });
    })
    .map(function(row) {
      var item = {};

      headers.forEach(function(header, index) {
        item[header] = formatDateValue(row[index]);
      });

      return item;
    });

  return jsonResponse({
    success: true,
    system: 'rfid',
    total: totalRows,
    returned: data.length,
    limit: limit,
    data: data
  });
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(header) {
    return String(header).trim();
  });

  var changed = false;

  HEADERS.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      currentHeaders.push(header);
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
  }
}

function hitungDurasiDariSheet(sheet, uidCari, waktuKembali) {
  if (!uidCari) {
    return { terdeteksi: false, durasi: 'Tidak terdeteksi', durasiDetik: 0 };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return { terdeteksi: false, durasi: 'Tidak terdeteksi', durasiDetik: 0 };
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function(header) {
    return String(header).trim();
  });

  var idxTimestamp = headers.indexOf('Timestamp');
  var idxUID = headers.indexOf('UID Kartu');
  var idxStatus = headers.indexOf('Status');

  if (idxTimestamp === -1 || idxUID === -1 || idxStatus === -1) {
    return { terdeteksi: false, durasi: 'Tidak terdeteksi', durasiDetik: 0 };
  }

  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    var uidRow = String(row[idxUID] || '').trim().toUpperCase();
    var statusRow = String(row[idxStatus] || '').trim().toUpperCase();

    if (uidRow === uidCari && isBorrowStatus(statusRow)) {
      var waktuPinjam = row[idxTimestamp];

      if (!(waktuPinjam instanceof Date)) {
        waktuPinjam = new Date(waktuPinjam);
      }

      if (isNaN(waktuPinjam.getTime())) {
        return { terdeteksi: false, durasi: 'Tidak terdeteksi', durasiDetik: 0 };
      }

      var durasiDetik = Math.max(0, Math.floor((waktuKembali.getTime() - waktuPinjam.getTime()) / 1000));

      return {
        terdeteksi: true,
        durasi: formatDurasi(durasiDetik),
        durasiDetik: durasiDetik
      };
    }
  }

  return { terdeteksi: false, durasi: 'Tidak terdeteksi', durasiDetik: 0 };
}

function isBorrowStatus(status) {
  var value = String(status || '').trim().toUpperCase();
  return value === 'DIPINJAM' || value === 'MEMINJAM';
}

function isReturnStatus(status) {
  var value = String(status || '').trim().toUpperCase();
  return value === 'DIKEMBALIKAN' || value === 'MENGEMBALIKAN';
}

function formatDurasi(totalDetik) {
  var hari = Math.floor(totalDetik / 86400);
  var jam = Math.floor((totalDetik % 86400) / 3600);
  var menit = Math.floor((totalDetik % 3600) / 60);
  var detik = totalDetik % 60;
  var teks = '';

  if (hari > 0) {
    teks += hari + ' hari ';
  }
  if (jam > 0 || hari > 0) {
    teks += jam + ' jam ';
  }
  if (menit > 0 || jam > 0 || hari > 0) {
    teks += menit + ' menit ';
  }

  teks += detik + ' detik';
  return teks;
}

function formatDateValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  return value;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
