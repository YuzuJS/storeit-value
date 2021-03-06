import _ from "underscore";
import { makeEmitter } from "pubit-as-promised";
import makeValueType from "./makeValueType";

export default class StoreitValue {
    constructor(store, properties) {
        this._publish = makeEmitter(this, ["changed", "removed"]); // on/off/once mixed in.
        this._store = store;
        var primaryKey = store.options.primaryKey;

        if (!(primaryKey in properties)) {
            throw new Error("StoreitValue creation failed! Missing primary key in properties.");
        }

        this._primaryKeyName = primaryKey;
        this._key = properties[primaryKey];

        // Populate store with values if provided.
        if (Object.keys(properties).length > 1) {
            this._store.set(properties);
        }

        this._onModified = this._publishChangedIfValueModified.bind(this);
        this._onRemoved = this._unsubscribeToStoreIfRemoved.bind(this);
        this.on = _.wrap(this.on, this._ensureListening.bind(this));
        this.once = _.wrap(this.once, this._ensureListening.bind(this));
        this._startOnce = _.once(this._start.bind(this));
    }

    _ensureListening(originalFn, ...args) {
        this._startOnce();
        return originalFn(...args);
    }

    // Listen for store changes involving this value.
    _start() {
        this._store.on("modified", this._onModified);
        this._store.on("removed", this._onRemoved);
    }

    get key() {
        return this._key;
    }

    get store() {
        return this._store;
    }

    get isStored() {
        return this._store.has(this._key);
    }

    has(prop) {
        var value = this._getFromStore();
        return value && prop in value;
    }

    get(prop) {
        var value = this._getFromStore();
        return value && prop in value ? value[prop] : undefined;
    }

    set(...args) {
        var update;
        if (args.length === 1) {
            update = args[0];
        } else {
            var [prop, value] = args;
            update = { [prop]: value };
        }
        return this._store.set(this._key, update);
    }

    toObject() {
        return this.isStored ? this._getFromStore() : { [this._primaryKeyName]: this.key };
    }

    dispose() {
        this._store.off("modified", this._onModified);
        this._store.off("removed", this._onRemoved);
    }

    static extend(typeOptions) {
        return makeValueType(StoreitValue, typeOptions);
    }

    _getFromStore() {
        return this.isStored ? this._store.get(this._key) : undefined;
    }

    _publishChangedIfValueModified(value, key) {
        if (key === this._key) {
            this._publish("changed", value);
        }
    }

    _unsubscribeToStoreIfRemoved(value, key) {
        if (key === this._key) {
            this._publish("removed");
            this.dispose();
        }
    }
}
