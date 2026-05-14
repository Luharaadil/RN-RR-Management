# Updated Google Apps Script

Copy and paste this into your Google Apps Script editor. We added the `getUsers` action to the `doGet` function so the web application can verify the connection to the `users` sheet.

```javascript
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheetName;
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // =========================================================
    // SMART RULE 1: UPDATE COLUMN K (Based on Date and Rubber)
    // =========================================================
    if (payload.action === "update_col_k") {
      var targetDateStr = String(payload.date).trim();
      var targetParts = targetDateStr.split("-");
      var tYear = parseInt(targetParts[0], 10);
      var tMonth = parseInt(targetParts[1], 10);
      var tDay = parseInt(targetParts[2], 10);
      
      var updates = payload.updates;
      
      // Create a fast lookup map for Rubber Names
      var updateMap = {};
      for (var u = 0; u < updates.length; u++) {
        updateMap[updates[u].rr] = updates[u].val;
      }
      
      var lastRow = sheet.getLastRow();
      if (lastRow > 0) {
        var dateValues = sheet.getRange(1, 1, lastRow, 1).getValues();
        var rrValues = sheet.getRange(1, 4, lastRow, 1).getValues();
        
        for (var i = 0; i < lastRow; i++) {
          var cellValue = dateValues[i][0];
          var sheetRR = String(rrValues[i][0]).trim();
          var isMatch = false;
          
          if (cellValue) {
            if (cellValue instanceof Date) {
              if (cellValue.getFullYear() === tYear && 
                 (cellValue.getMonth() + 1) === tMonth && 
                  cellValue.getDate() === tDay) {
                  isMatch = true;
              }
            } else {
              var cellStr = String(cellValue).trim();
              if (cellStr === targetDateStr) {
                  isMatch = true;
              } else {
                var parsedDate = new Date(cellStr);
                if (!isNaN(parsedDate.getTime())) {
                    if (parsedDate.getFullYear() === tYear && 
                       (parsedDate.getMonth() + 1) === tMonth && 
                        parsedDate.getDate() === tDay) {
                        isMatch = true;
                    }
                }
              }
            }
          }
          
          if (isMatch && updateMap.hasOwnProperty(sheetRR)) {
            sheet.getRange(i + 1, 11).setValue(updateMap[sheetRR]);
          }
        }
      }
      return ContentService.createTextOutput("Success: Column K updated for " + targetDateStr);
    }
    
    // =========================================================
    // SMART RULE 2: REPLACE DATE & APPEND 
    // =========================================================
    else if (sheetName.toUpperCase() === "DATA" || payload.action === "append") {
      var data = payload.data;
      if (data.length > 0) {
        var targetDateStr = String(data[0][0]).trim(); 
        var targetParts = targetDateStr.split("-");
        var tYear = parseInt(targetParts[0], 10);
        var tMonth = parseInt(targetParts[1], 10);
        var tDay = parseInt(targetParts[2], 10);
        
        var lastRow = sheet.getLastRow();
        
        if (lastRow > 0) {
          var currentDates = sheet.getRange(1, 1, lastRow, 1).getValues(); 
          
          for (var i = lastRow - 1; i >= 0; i--) {
            var cellValue = currentDates[i][0];
            var isMatch = false;
            
            if (cellValue) {
              if (cellValue instanceof Date) {
                if (cellValue.getFullYear() === tYear && 
                   (cellValue.getMonth() + 1) === tMonth && 
                    cellValue.getDate() === tDay) {
                    isMatch = true;
                }
              } else {
                var cellStr = String(cellValue).trim();
                if (cellStr === targetDateStr) {
                    isMatch = true;
                } else {
                  var parsedDate = new Date(cellStr);
                  if (!isNaN(parsedDate.getTime())) {
                      if (parsedDate.getFullYear() === tYear && 
                         (parsedDate.getMonth() + 1) === tMonth && 
                          parsedDate.getDate() === tDay) {
                          isMatch = true;
                      }
                  }
                }
              }
            }
            
            if (isMatch) {
              sheet.deleteRow(i + 1); 
            }
          }
        }
        
        var newLastRow = sheet.getLastRow();
        if (newLastRow === 0) {
          sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
        } else {
          sheet.getRange(newLastRow + 1, 1, data.length, data[0].length).setValues(data);
        }

        // ---> NEW: Set Column J to Percentage Format <---
        sheet.getRange("J2:J").setNumberFormat("0.00%");
      }
    } 
    // =========================================================
    // STANDARD RULE: OVERWRITE RAW SHEETS
    // =========================================================
    else {
      var data = payload.data;
      sheet.clearContents();
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
    
    return ContentService.createTextOutput("Success: " + sheetName + " updated cleanly.");
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if we are requesting users
    if (e.parameter && e.parameter.action === "getUsers") {
      var userSheet = ss.getSheetByName("users");
      if (!userSheet) {
          throw new Error("Sheet named 'users' not found");
      }
      var userData = userSheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify(userData))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default to DATA sheet
    var sheet = ss.getSheetByName("DATA"); 
    
    if (!sheet) {
      throw new Error("Sheet named 'DATA' not found");
    }
    
    var data = sheet.getDataRange().getValues();
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"error": err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```
