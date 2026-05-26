import Database from "better-sqlite3";
const db = new Database("./.data/folio.sqlite", { readonly: true });
console.log("Profiles:", JSON.stringify(db.prepare("select id, email from profiles").all(), null, 2));
console.log("Assets:", JSON.stringify(db.prepare("select id, user_id, name, ticker, category from assets").all(), null, 2));
console.log("Tx count:", db.prepare("select count(*) as c from transactions").get());
console.log("Properties:", db.prepare("select asset_id, address_line1 from properties").all());
