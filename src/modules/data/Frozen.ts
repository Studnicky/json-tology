export class Frozen {
  public static deepFreeze<T>(value: T): T {
    return Frozen.freezeValue(value, new WeakSet());
  }

  private static freezeValue<T>(value: T, seen: WeakSet<object>): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    const obj = value as object;

    if (seen.has(obj)) {
      return value;
    }

    seen.add(obj);
    Object.freeze(obj);

    if (Array.isArray(obj)) {
      for (const item of obj) {
        Frozen.freezeValue(item, seen);
      }
    } else {
      for (const child of Object.values(obj)) {
        Frozen.freezeValue(child, seen);
      }
    }

    return value;
  }
}
