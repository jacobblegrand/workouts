const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const initSqlJs=require('sql.js');
const {IDBFactory}=require('fake-indexeddb');

function setup(legacy){
 const storage=new Map(legacy?[['forma-v1',JSON.stringify(legacy)]]:[]);
 const context={exports:{},require:name=>name==='sql.js'?{default:()=>initSqlJs()}:require(name),indexedDB:new IDBFactory(),localStorage:{getItem:k=>storage.get(k)||null},navigator:{},document:{baseURI:'http://localhost/'},URL,structuredClone,console};
 vm.createContext(context);
 vm.runInContext(ts.transpileModule(fs.readFileSync('src/database.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {Database:context.exports.WorkoutDatabase,storage};
}
const legacy={history:[{id:123,date:'2026-10-27',type:'A',entries:[{weight:'25',reps:['8','8','7'],rpe:'8'}]}],entries:[{weight:'20',reps:['12','',''],rpe:''}],unit:'lb'};
const normalize=x=>JSON.parse(JSON.stringify(x));
test('migrates legacy data into a valid SQLite file and reopens it',async()=>{
 const {Database,storage}=setup(legacy);const first=new Database();
 assert.deepEqual(normalize(await first.open()),legacy);
 assert.ok(storage.has('forma-v1'),'legacy backup retained');
 assert.equal(Buffer.from(first.db.export().slice(0,16)).toString(),'SQLite format 3\0');
 assert.deepEqual(normalize(await new Database().open()),legacy);
});
test('serializes rapid saves and preserves durable data on failed writes',async()=>{
 const {Database}=setup();const db=new Database();await db.open();
 const a=structuredClone(legacy),b=structuredClone(legacy);b.entries[0].weight='30';
 await Promise.all([db.save(a),db.save(b)]);
 assert.deepEqual(normalize(await new Database().open()),b);
 const persist=db.persist.bind(db);db.persist=async()=>{throw Error('Disk full');};
 await assert.rejects(db.save(a),/Disk full/);
 assert.deepEqual(normalize(db.read()),b);
 assert.deepEqual(normalize(await new Database().open()),b);
 db.persist=persist;await db.save(a);
 assert.deepEqual(normalize(await new Database().open()),a);
});

