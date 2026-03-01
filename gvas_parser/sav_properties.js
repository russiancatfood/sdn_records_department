/**
 * Utility to map JSON objects back to their respective class prototypes.
 */
export function assignPrototype(rawProperty) {
    const propertyType = rawProperty.type;
    const propertyMapping = {
        HeaderProperty, NoneProperty, BoolProperty, IntProperty,
        Int64Property, UInt32Property, StrProperty, NameProperty,
        ByteProperty, EnumProperty, FloatProperty, StructProperty,
        ArrayProperty, MulticastInlineDelegateProperty, MapProperty,
        SetProperty, ObjectProperty, SoftObjectProperty, FileEndProperty
    };


    

    if (propertyMapping[propertyType]) {
        return propertyMapping[propertyType].fromJson(rawProperty);
    } else {
        throw new Error(`Unknown property type: ${propertyType}`);
    }
}

// Note: These classes assume write utility functions (write_int32, etc.) 
// are imported from a SavWriter.js equivalent.

export class HeaderProperty {
    static GVAS = new Uint8Array([0x47, 0x56, 0x41, 0x53]);

    constructor(savReader) {
        this.type = "HeaderProperty";
        if (!savReader) return;

        savReader.readBytes(HeaderProperty.GVAS.length);
        this.save_game_version = savReader.readInt32();
        this.package_version = savReader.readInt32();
        
        const engine_parts = [
            savReader.readInt16(),
            savReader.readInt16(),
            savReader.readInt16()
        ];
        this.engine_version = engine_parts.join(".");
        this.engine_build = savReader.readUint32();
        this.engine_branch = savReader.readString();
        this.custom_version_format = savReader.readInt32();
        
        const numCustomVersions = savReader.readInt32();
        this.custom_versions = [];
        for (let i = 0; i < numCustomVersions; i++) {
            this.custom_versions.push([
                savReader.readBytes(16),
                savReader.readInt32()
            ]);
        }
        this.save_game_class_name = savReader.readString();
    }

    static fromJson(json) {
        const instance = new HeaderProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class NoneProperty {
    static bytes = new Uint8Array([0x05, 0x00, 0x00, 0x00, 0x4E, 0x6F, 0x6E, 0x65, 0x00]);

    constructor() {
        this.type = "NoneProperty";
    }

    static fromJson(json) {
        const instance = new NoneProperty();
        Object.assign(instance, json);
        return instance;
    }

    toBytes() {
        return NoneProperty.bytes;
    }
}

export class BoolProperty {
    static padding = new Uint8Array(8).fill(0);

    constructor(name, savReader) {
        this.type = "BoolProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readBytes(BoolProperty.padding.length);
        this.value = savReader.readBoolean();
        savReader.readBytes(1);
    }

    static fromJson(json) {
        const instance = new BoolProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class IntProperty {
    static padding = new Uint8Array([0x04, 0, 0, 0, 0, 0, 0, 0, 0]);

    constructor(name, savReader) {
        this.type = "IntProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readBytes(IntProperty.padding.length);
        this.value = savReader.readInt32();
    }

    static fromJson(json) {
        const instance = new IntProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class Int64Property {
    static padding = new Uint8Array([0x08, 0, 0, 0, 0, 0, 0, 0, 0]);

    constructor(name, savReader) {
        this.type = "Int64Property";
        this.name = name;
        if (!savReader) return;

        savReader.readBytes(Int64Property.padding.length);
        this.value = savReader.readInt64(); // Returns BigInt
    }

    static fromJson(json) {
        const instance = new Int64Property();
        Object.assign(instance, json);
        // Ensure value is handled as BigInt if stringified in JSON
        if (typeof instance.value === 'string') instance.value = BigInt(instance.value);
        return instance;
    }
}

export class StrProperty {
    static padding = new Uint8Array(8).fill(0);

    constructor(name, savReader) {
        this.type = "StrProperty";
        this.name = name;
        if (!savReader) return;

        this.unknown = savReader.readBytes(1);
        savReader.readBytes(StrProperty.padding.length);
        const { result, wide } = savReader.readStringSpecial();
        this.value = result;
        if (wide) this.wide = true;
    }

    static fromJson(json) {
        const instance = new StrProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class StructProperty {
    static padding = new Uint8Array(4).fill(0);
    static unknown = new Uint8Array(17).fill(0);

    constructor(name, savReader) {
        this.type = "StructProperty";
        this.name = name;
        if (!savReader) return;

        const contentSize = savReader.readUint32();
        savReader.readBytes(4);
        this.subtype = savReader.readString();
        savReader.readBytes(17);

        const contentEndPosition = savReader.offset + contentSize;

        if (this.subtype === "Guid") {
            this.value = savReader.readBytes(16);
            return;
        }

        if (this.subtype === "DateTime") {
            this.value = savReader.readDateTime();
            return;
        }

        if (["Quat", "Vector", "Rotator"].includes(this.subtype)) {
            this.value = savReader.readBytes(contentSize);
            return;
        }

        this.value = [];
        while (savReader.offset < contentEndPosition) {
            const prop = savReader.readProperty();
            if (prop) this.value.push(prop);
            else break; // Handle NoneProperty return null
        }
    }

    static fromJson(json) {
        const instance = new StructProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class ArrayProperty {
    static padding = new Uint8Array(4).fill(0);
    static unknown = new Uint8Array(17).fill(0);

    constructor(name, savReader) {
        this.type = "ArrayProperty";
        this.name = name;
        if (!savReader) return;

        const contentSize = savReader.readUint32();
        savReader.readBytes(4);
        this.subtype = savReader.readString();
        savReader.readBytes(1);

        if (this.subtype === "StructProperty") {
            const contentCount = savReader.readUint32();
            const nameAgain = savReader.readString();
            const subtypeAgain = savReader.readString();
            savReader.readUint32(); // arraySize
            savReader.readBytes(ArrayProperty.padding.length);
            this.generic_type = savReader.readString();
            savReader.readBytes(17); // unknown

            this.value = [];
            for (let i = 0; i < contentCount; i++) {
                if (this.generic_type === "Guid") {
                    this.value.push(savReader.readBytes(16));
                } else {
                    const structElements = [];
                    let childProp = null;
                    do {
                        childProp = savReader.readProperty();
                        structElements.push(childProp);
                    } while (childProp && childProp.type !== "NoneProperty");
                    this.value.push(structElements);
                }
            }
        } else if (["ObjectProperty", "EnumProperty", "NameProperty", "StrProperty"].includes(this.subtype)) {
            const contentCount = savReader.readUint32();
            this.value = [];
            for (let i = 0; i < contentCount; i++) {
                this.value.push(savReader.readString());
            }
        } else {
            this.value = savReader.readBytes(contentSize);
        }
    }

    static fromJson(json) {
        const instance = new ArrayProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class FileEndProperty {
    static bytes = new Uint8Array([...NoneProperty.bytes, 0, 0, 0, 0]);

    constructor() {
        this.type = "FileEndProperty";
    }

    static fromJson(json) {
        const instance = new FileEndProperty();
        Object.assign(instance, json);
        return instance;
    }

    static toBytes() {
        return FileEndProperty.bytes;
    }
}

export class ByteProperty {
    static padding = new Uint8Array(4).fill(0);

    constructor(name, savReader) {
        this.type = "ByteProperty";
        this.name = name;
        if (!savReader) return;

        // ByteProperty in GVAS can be a single byte or a string (enum)
        const contentSize = savReader.readUint32();
        savReader.readBytes(ByteProperty.padding.length);
        this.subtype = savReader.readString();
        savReader.readBytes(1); // Unknown separator byte

        if (this.subtype === "None") {
            // If subtype is "None", it's a single byte value
            this.value = savReader.readBytes(1)[0];
        } else {
            // Otherwise, it's treated as a string value (typically an enum)
            this.value = savReader.readString();
        }
    }

    /**
     * Creates an instance from a JSON object.
     * @param {Object} json 
     * @returns {ByteProperty}
     */
    static fromJson(json) {
        const instance = new ByteProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class EnumProperty {
    static padding = new Uint8Array(4).fill(0);

    constructor(name, savReader) {
        this.type = "EnumProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readUint32(); // contentSize
        savReader.readBytes(EnumProperty.padding.length);
        this.subtype = savReader.readString();
        savReader.readBytes(1); // Unknown separator byte
        this.value = savReader.readString();
    }

    static fromJson(json) {
        const instance = new EnumProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class UInt32Property {
    static padding = new Uint8Array([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    constructor(name, savReader) {
        this.type = "UInt32Property";
        this.name = name;
        if (!savReader) return;

        savReader.readBytes(UInt32Property.padding.length);
        this.value = savReader.readUint32();
    }

    static fromJson(json) {
        const instance = new UInt32Property();
        Object.assign(instance, json);
        return instance;
    }
}

export class FloatProperty {
    static padding = new Uint8Array([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

    constructor(name, savReader) {
        this.type = "FloatProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readBytes(FloatProperty.padding.length);
        this.value = savReader.readFloat32();
    }

    static fromJson(json) {
        const instance = new FloatProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class NameProperty {
    static padding = new Uint8Array(8).fill(0);

    constructor(name, savReader) {
        this.type = "NameProperty";
        this.name = name;
        if (!savReader) return;

        this.unknown = savReader.readBytes(1);
        savReader.readBytes(NameProperty.padding.length);
        this.value = savReader.readString();
    }

    static fromJson(json) {
        const instance = new NameProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class ObjectProperty {
    static padding = new Uint8Array(5).fill(0);

    constructor(name, savReader) {
        this.type = "ObjectProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readUint32(); // contentSize
        savReader.readBytes(ObjectProperty.padding.length);
        this.value = savReader.readString();
    }

    static fromJson(json) {
        const instance = new ObjectProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class SoftObjectProperty {
    static padding = new Uint8Array(5).fill(0);

    constructor(name, savReader) {
        this.type = "SoftObjectProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readUint32(); // contentSize
        savReader.readBytes(SoftObjectProperty.padding.length);
        this.value = savReader.readString();
        savReader.readBytes(4); // Trailing 4 bytes
    }

    static fromJson(json) {
        const instance = new SoftObjectProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class MulticastInlineDelegateProperty {
    static padding = new Uint8Array(5).fill(0);
    static unknown = new Uint8Array([0x01, 0x00, 0x00, 0x00]);

    constructor(name, savReader) {
        this.type = "MulticastInlineDelegateProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readUint32(); // contentSize
        savReader.readBytes(MulticastInlineDelegateProperty.padding.length);
        savReader.readBytes(MulticastInlineDelegateProperty.unknown.length);
        this.object_name = savReader.readString();
        this.function_name = savReader.readString();
    }

    static fromJson(json) {
        const instance = new MulticastInlineDelegateProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class MapProperty {
    static padding = new Uint8Array(4).fill(0);

    constructor(name, savReader) {
        this.type = "MapProperty";
        this.name = name;
        if (!savReader) return;

        savReader.readUint32(); // contentSize
        savReader.readBytes(MapProperty.padding.length);
        this.key_type = savReader.readString();
        this.value_type = savReader.readString();
        savReader.readBytes(1);
        savReader.readBytes(MapProperty.padding.length);
        
        const contentCount = savReader.readUint32();
        this.value = [];

        for (let i = 0; i < contentCount; i++) {
            let currentKey;
            let currentValue;

            // Handle Keys
            if (this.key_type === "StructProperty") {
                currentKey = savReader.readBytes(16); // Typically a GUID
            } else if (this.key_type === "IntProperty") {
                currentKey = savReader.readInt32();
            } else if (["StrProperty", "NameProperty"].includes(this.key_type)) {
                currentKey = savReader.readString();
            } else {
                throw new Error(`Key Type not implemented: ${this.key_type}`);
            }

            // Handle Values
            if (this.value_type === "StructProperty") {
                currentValue = [];
                let prop = null;
                do {
                    prop = savReader.readProperty();
                    currentValue.push(prop);
                } while (prop && prop.type !== "NoneProperty");
            } else if (this.value_type === "IntProperty") {
                currentValue = savReader.readInt32();
            } else if (this.value_type === "FloatProperty") {
                currentValue = savReader.readFloat32();
            } else if (["StrProperty", "EnumProperty"].includes(this.value_type)) {
                currentValue = savReader.readString();
            } else if (this.value_type === "BoolProperty") {
                currentValue = savReader.readBytes(1)[0] !== 0;
            } else {
                throw new Error(`Value Type not implemented: ${this.value_type}`);
            }

            this.value.push([currentKey, currentValue]);
        }
    }

    static fromJson(json) {
        const instance = new MapProperty();
        Object.assign(instance, json);
        return instance;
    }
}

export class SetProperty {
    static padding = new Uint8Array(4).fill(0);

    constructor(name, savReader) {
        this.type = "SetProperty";
        this.name = name;
        if (!savReader) return;

        const contentSize = savReader.readUint32();
        savReader.readBytes(SetProperty.padding.length);
        this.subtype = savReader.readString();
        savReader.readBytes(1);

        if (this.subtype === "StructProperty") {
            savReader.readBytes(SetProperty.padding.length);
            const contentCount = savReader.readUint32();
            this.value = [];
            for (let i = 0; i < contentCount; i++) {
                const structElements = [];
                let childProp = null;
                do {
                    childProp = savReader.readProperty();
                    structElements.push(childProp);
                } while (childProp && childProp.type !== "NoneProperty");
                this.value.push(structElements);
            }
        } else if (this.subtype === "NameProperty") {
            savReader.readBytes(4);
            const contentCount = savReader.readUint32();
            this.value = [];
            for (let i = 0; i < contentCount; i++) {
                this.value.push(savReader.readString());
            }
        } else {
            // Fallback for raw byte data
            this.value = savReader.readBytes(contentSize);
        }
    }

    static fromJson(json) {
        const instance = new SetProperty();
        Object.assign(instance, json);
        return instance;
    }
}