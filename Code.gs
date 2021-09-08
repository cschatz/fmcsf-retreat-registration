// Overall app configuration
// ** Note: These should really be constants, but implementation of "const" in apps scripting seems to be broken, 
// ** and causes nonsensical errors when I use it.
// ** See http://ramblings.mcpher.com/Home/excelquirks/gassnips/constsandscopes,
// **    especially the first sentence under "Conclusion".

var WEBPAGE_TITLE = "Retreat 20__ Registration";
var SPREADSHEET_DOCUMENT_NAME = "Demo Registration Records";
var MAIN_SHEET_NAME = "main"; // which sheet in the spreadsheet to save submitted data into
var SECONDARY_SHEET_NAME = "individuals"; // which sheet to transfer per-individual data into
var CONFIRM_SENDER_NAME = "Colin Schatz";
var CONFIRM_CC_EMAILS = "colin.schatz+retreat@gmail.com";


// Prefixes for headers used for multiple people in the same registration
var HEADER_PREFIXES = ['name', 'age', 'fri_night', 'sat_night', 'sat_bfast', 'sat_lunch', 'sat_dinner', 'sun_bfast', 'sun_lunch'];


// Boilerplate code that replies to GET requests when this is deployed as a web app.
// See: https://developers.google.com/apps-script/guides/web
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  // Logger.log("get " + Date());
  return template.evaluate()
      .setTitle(WEBPAGE_TITLE)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// Function to push one entire row into the given sheet,
//  given a hash of header names to values
function pushOneRow(record, headers, sheet) {
  var row_to_add = new Array(headers.length);
  for (i = 0; i < row_to_add.length; i++)
    row_to_add[i] = "";
  for (k = 0; k < headers.length; k++)
  {
    var header_name = headers[k];
    if (header_name in record) 
      row_to_add[k] = record[header_name];
  }
  sheet.appendRow(row_to_add);
}

// Function to send a confirmation email to the email address entered in the form
function sendConfirmationEmail(address, contents) {
  var msg = "Thank you for registering for Retreat. We look forward to seeing you there!\n\n";
  msg += "A summary of your registration is listed below.\n";
  msg += "Please reply to this message if you have any questions or concerns.\n\n";
  msg += "       -- " + CONFIRM_SENDER_NAME + ", on behalf of Retreat Committee\n\n";
  msg += "[P.S.: This message is generated automatically. A member of Retreat Committee will follow ";
  msg += "up with you individually on any specific requests you may have included in your registration.]\n\n";
  msg += "\n";
  msg += contents;
    
  GmailApp.sendEmail(address, "FMCSF Retreat - Registration Confirmation", msg,
                     { cc: CONFIRM_CC_EMAILS } );
  
  Logger.log("Email sent to " + address);
}

// This function is called when the user clicks the button with ID "register_button".
// The code that triggers this is actually in the setupValidation() function in the JavaScript.html file.
// See the "submitHandler" key inside the Javascript object passed to the .validate() call there.
function processForm(formObject) {
  var spreadsheet_file = DriveApp.getFilesByName(SPREADSHEET_DOCUMENT_NAME).next();
  var file_id = spreadsheet_file.getId();
  var doc = SpreadsheetApp.openById(file_id);
  var main_sheet = doc.getSheetByName(MAIN_SHEET_NAME);
  var secondary_sheet = doc.getSheetByName(SECONDARY_SHEET_NAME);  
  // header rows of respective sheets
  var main_headers = main_sheet.getRange(1, 1, 1, main_sheet.getLastColumn()).getValues()[0];
  var secondary_headers = secondary_sheet.getRange(2, 1, 1, secondary_sheet.getLastColumn()).getValues()[0];
  var group_num = main_sheet.getLastRow();
  
  // Add timestamp key-value pair explicitly to the formObject so it will end up in the spreadsheet
  formObject['timestamp'] = new Date();
  // push all data into a next row of the main sheet
  pushOneRow(formObject, main_headers, main_sheet);
  Logger.log("Registration record (" + formObject['registrant_name'] + ") added to main sheet.");

  // Rearrange data and put into secondary sheet
  var secondary_record = {}
  secondary_record['group_num'] = group_num;
  for (i = 0; i < main_headers.length; i++) {
    header = main_headers[i];
    adjusted_header = header.replace("registrant_", "").replace("attendee_1_", "").replace("attendee_", "");
    if (!(header in formObject)) {
      secondary_record[adjusted_header] = "";
    } else {
      secondary_record[adjusted_header] = formObject[header];
    }
  }
  pushOneRow(secondary_record, secondary_headers, secondary_sheet);

  // Check for additional people in the current registration
  for (n = 2; n <= 6; n++)
  {
    var additional_record = {};
    additional_record['group_num'] = group_num;
    additional_record['lodging_first_choice'] = secondary_record['lodging_first_choice'];
    additional_record['lodging_second_choice'] = secondary_record['lodging_second_choice'];  
    if (secondary_record[n + "_name"] == "") // no more party members in this record
          break;
    for (p in HEADER_PREFIXES)
    {
      var src_field = n + "_" + HEADER_PREFIXES[p];
      var dst_field = src_field.replace(n + "_", "");
      additional_record[dst_field] = secondary_record[src_field];
    }
    pushOneRow(additional_record, secondary_headers, secondary_sheet);
  }
  
  Logger.log("Registration record (" + formObject['registrant_name'] + ") added to secondary sheet.")
    
  // send confirmation email
  sendConfirmationEmail(formObject['registrant_email'], formObject["confirmation_contents"]);
  
}
