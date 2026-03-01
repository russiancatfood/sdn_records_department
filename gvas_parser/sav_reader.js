/**
 * SavReader: A JavaScript implementation for reading Unreal Engine GVAS .sav files.
 * Uses DataView for binary parsing and TextDecoder for string conversion.
 */
 
import {
    HeaderProperty, BoolProperty, IntProperty,
    Int64Property, UInt32Property, StrProperty, NameProperty,
    ByteProperty, EnumProperty, FloatProperty, StructProperty,
    ArrayProperty, MulticastInlineDelegateProperty, MapProperty,
    SetProperty, ObjectProperty, SoftObjectProperty } from "./sav_properties.js";

export class SavReader {
    constructor(fileArrayBuffer) {
        // Ensure we are working with an ArrayBuffer or a TypedArray's buffer
        this.buffer = fileArrayBuffer instanceof ArrayBuffer 
            ? fileArrayBuffer 
            : fileArrayBuffer.buffer;
        
        this.dataView = new DataView(this.buffer);
        this.offset = 0;
        this.fileSize = this.buffer.byteLength;
        this.decoder = new TextDecoder('utf-8');
        this.utf16Decoder = new TextDecoder('utf-16le');
    }

    hasFinished() {
        return this.offset >= this.fileSize;
    }

    readBytes(count) {
        const result = new Uint8Array(this.buffer, this.offset, count);
        this.offset += count;
        return result;
    }

    readInt16() {
        const value = this.dataView.getInt16(this.offset, true); // true = little-endian
        this.offset += 2;
        return value;
    }

    readInt32() {
        const value = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readUint32() {
        const value = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readFloat32() {
        const value = this.dataView.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readInt64() {
        // JavaScript BigInt handles 64-bit integers
        const value = this.dataView.getBigInt64(this.offset, true);
        this.offset += 8;
        return value;
    }

    readString() {
        const length = this.readInt32();
        if (length === 0) return "";
        
        // Exclude the null terminator (length - 1)
        const rawBytes = new Uint8Array(this.buffer, this.offset, length - 1);
        const result = this.decoder.decode(rawBytes);
        this.offset += length;
        return result;
    }

    readStringSpecial() {
        let length = this.readInt32();
        let wide = false;
        let result = "";
        let nullTerminatorSize = 1;

        if (length < 0) {
            length = Math.abs(length) * 2;
            wide = true;
            nullTerminatorSize = 2;
        }

        const rawBytes = new Uint8Array(this.buffer, this.offset, length - nullTerminatorSize);
        
        if (wide) {
            result = this.utf16Decoder.decode(rawBytes);
        } else {
            result = this.decoder.decode(rawBytes);
        }

        this.offset += length;
        return { result, wide };
    }

    readBoolean() {
        const result = this.dataView.getUint8(this.offset) !== 0;
        this.offset += 1;
        return result;
    }

    readDateTime() {
        // Ticks are 100-nanosecond intervals since Jan 1, 0001
        const ticks = this.dataView.getBigUint64(this.offset, true);
        this.offset += 8;
        
        try {
            // Convert ticks to milliseconds and adjust for Unix Epoch (1970)
            const unixTimeMs = Number((ticks / 10000n) - 62135596800000n);
            return new Date(unixTimeMs);
        } catch (e) {
            return ticks;
        }
    }

    readWholeBuffer() {
        const output = [];
        try {
            // Note: HeaderProperty must be available (imported from SavProperties.js)
            const headerProperty = new HeaderProperty(this);
            output.push(headerProperty);
        } catch (e) {
            throw new Error(
                'Failed to read HeaderProperty due to invalid or obfuscated GVAS .sav format.\n' +
                'Please provide a path to a valid uncompressed Unreal Engine GVAS .sav file.'
            );
        }

        while (!this.hasFinished()) {
            const nextProperty = this.readProperty();
            if(nextProperty === null){
                // Terminate read when we get a null property
                this.offset = this.fileSize;
            }else{
                output.push(nextProperty);
            }
        }
        return output;
    }

    readProperty() {
        // Note: This logic assumes classes like HeaderProperty, BoolProperty, etc. 
        // are defined elsewhere in your JS project.
        
        const propertyName = this.readString();
        if (propertyName === "None") {
            return null; // Equivalent to NoneProperty in Python version
        }

        const propertyType = this.readString();

        switch (propertyType) {
            case "HeaderProperty": return new HeaderProperty(propertyName, this);
            case "BoolProperty": return new BoolProperty(propertyName, this);
            case "IntProperty": return new IntProperty(propertyName, this);
            case "Int64Property": return new Int64Property(propertyName, this);
            case "UInt32Property": return new UInt32Property(propertyName, this);
            case "FloatProperty": return new FloatProperty(propertyName, this);
            case "EnumProperty": return new EnumProperty(propertyName, this);
            case "StructProperty": return new StructProperty(propertyName, this);
            case "ByteProperty": return new ByteProperty(propertyName, this);
            case "StrProperty": return new StrProperty(propertyName, this);
            case "NameProperty": return new NameProperty(propertyName, this);
            case "SetProperty": return new SetProperty(propertyName, this);
            case "ArrayProperty": return new ArrayProperty(propertyName, this);
            case "ObjectProperty": return new ObjectProperty(propertyName, this);
            case "SoftObjectProperty": return new SoftObjectProperty(propertyName, this);
            case "MulticastInlineDelegateProperty": return new MulticastInlineDelegateProperty(propertyName, this);
            case "MapProperty": return new MapProperty(propertyName, this);
            default:
                throw new Error(`Unknown property type: ${propertyType}`);
        }
    }
}