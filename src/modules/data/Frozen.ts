export class Frozen {
  public static deepFreeze<T>(value: T): T {
    const result = Frozen.freezeValue(value, new WeakSet());

    return result;
  }

  private static freezeValue<T>(value: T, seen: WeakSet<object>): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    const object = value as object;

    if (seen.has(object)) {
      return value;
    }

    seen.add(object);
    Object.freeze(object);

    if (Array.isArray(object)) {
      for (const item of object) {
        Frozen.freezeValue(item, seen);
      }
    } else {
      for (const child of Object.values(object)) {
        Frozen.freezeValue(child, seen);
      }
    }

    return value;
  }
}
