import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

export interface StoredWorkout { id:number; date:string; type:string; [key:string]:unknown }
export interface SavedState { history:StoredWorkout[]; entries:unknown[]; unit:string }

// SQLite performs all data operations. IndexedDB durably stores its binary file.
export class WorkoutDatabase {
  private sql!:SqlJsStatic;
  private db!:Database;
  private disk!:IDBDatabase;
  private queue:Promise<void>=Promise.resolve();

  async open():Promise<SavedState|null>{
    this.sql=await initSqlJs({locateFile:()=>new URL('assets/sql-wasm.wasm',document.baseURI).href});
    this.disk=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open('workout-sqlite',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('files');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Close other workout tabs and reload.'));
    });
    const bytes=await new Promise<Uint8Array|undefined>((resolve,reject)=>{
      const request=this.disk.transaction('files').objectStore('files').get('workouts.sqlite');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    this.db=bytes?new this.sql.Database(bytes):new this.sql.Database();
    this.db.run(`CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS draft (id INTEGER PRIMARY KEY CHECK(id=1), entries TEXT NOT NULL, unit TEXT NOT NULL);`);
    if(!bytes){
      const legacy=localStorage.getItem('forma-v1');
      if(legacy){
        const parsed=JSON.parse(legacy);
        await this.save({history:parsed.history||[],entries:parsed.entries||[],unit:parsed.unit||'lb'});
      }else{await this.persist(this.db.export());}
    }
    void navigator.storage?.persist?.().catch(()=>false);
    return this.read();
  }

  private read():SavedState|null{
    const draft=this.db.exec('SELECT entries, unit FROM draft WHERE id=1')[0]?.values[0];
    if(!draft)return null;
    const history=(this.db.exec('SELECT data FROM workouts ORDER BY id')[0]?.values||[]).map(row=>JSON.parse(String(row[0])));
    return {history,entries:JSON.parse(String(draft[0])),unit:String(draft[1])};
  }

  save(state:SavedState):Promise<void>{
    const snapshot=structuredClone(state);
    const operation=this.queue.then(async()=>{
      const candidate=new this.sql.Database(this.db.export());
      try{
        candidate.run('BEGIN; DELETE FROM workouts;');
        for(const w of snapshot.history){candidate.run('INSERT INTO workouts (id,date,type,data) VALUES (?,?,?,?)',[w.id,w.date,w.type,JSON.stringify(w)]);}
        candidate.run('INSERT OR REPLACE INTO draft (id,entries,unit) VALUES (1,?,?)',[JSON.stringify(snapshot.entries),snapshot.unit]);
        candidate.run('COMMIT');
        await this.persist(candidate.export());
        this.db.close();this.db=candidate;
      }catch(error){candidate.close();throw error;}
    });
    this.queue=operation.catch(()=>{});
    return operation;
  }

  private persist(bytes:Uint8Array):Promise<void>{
    return new Promise((resolve,reject)=>{
      const transaction=this.disk.transaction('files','readwrite');
      transaction.objectStore('files').put(bytes,'workouts.sqlite');
      transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Database save aborted'));
    });
  }

  async download():Promise<void>{
    await this.queue;
    const bytes=this.db.export();
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.sqlite3'}));
    const a=document.createElement('a');a.href=url;a.download='workouts.sqlite';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
