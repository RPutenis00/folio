import Database from "better-sqlite3";
const db = new Database("./.data/folio.sqlite", { readonly: true });
console.log(JSON.stringify(db.prepare("select * from rental_scenarios").all(), null, 2));
