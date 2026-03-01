// Example for Node.js
import fs from 'fs';
import { SavReader } from './gvas_parser/sav_reader.js';

function readSav(filePath) {
    if (!filePath.endsWith('.sav')) {
        throw new Error("Please provide a path to a valid Unreal Engine GVAS .sav file.");
    }
    
    const buffer = fs.readFileSync(filePath);
    // Use the buffer.buffer to get the underlying ArrayBuffer
    const savReader = new SavReader(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    return savReader.readWholeBuffer();
}

const properties = readSav("./SaveSlot0.sav");

const stats = {};

for (const prop of properties) {
    if(prop.type === "ArrayProperty" && prop.name === "SceneSnapshots") {
        for (let i = 0; i < prop.value.length; i++) {
            for(let j = 0; j < prop.value[i][1].value.length; j++){
                const name = prop.value[i][1].value[j][0];
                const type = prop.value[i][1].value[j][1][0].type;
                const value = prop.value[i][1].value[j][1][0].value;
                if(name.startsWith("BV_") || name.startsWith("NV_")){
                    const data = new Uint8Array(value)
                    const view = new DataView(data.buffer);
                    const converted_value = parseInt(view.getFloat32(4, true));
                    if(stats[name] == null){
                        stats[name] = converted_value;
                    }else{
                        if(converted_value > stats[name]){
                            stats[name] = converted_value;
                        }
                    }

                }
            }
        }
    }
}

console.log(stats);
