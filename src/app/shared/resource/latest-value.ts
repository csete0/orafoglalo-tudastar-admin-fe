import { Resource, Signal, linkedSignal } from '@angular/core';

/**
 * A resource utolsó sikeres értéke. Új betöltés közben (paraméter-váltás, `reload()`) és hiba után is a korábbi érték
 * marad, amíg új nem érkezik — a resource saját `value()`-ja ilyenkor alapértékre vált, hibánál pedig kivételt dob.
 * A lista-oldalak így lapozás és sikertelen keresés közben is a korábbi sorokat mutatják.
 */
export function latestValue<T>(resource: Resource<T | undefined>): Signal<T | undefined> {
  return linkedSignal<T | undefined, T | undefined>({
    source: () => (resource.hasValue() ? resource.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });
}
