import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage, isRecord } from './extract-error-message.util';

describe('extractErrorMessage', () => {
  it('errorMessage alakú body esetén azt adja vissza', () => {
    expect(extractErrorMessage({ error: { errorMessage: 'Nincs jogosultságod.' } }, 'fallback')).toBe(
      'Nincs jogosultságod.',
    );
  });

  it('errors: string[] alakú body esetén a stringeket összefűzve adja vissza', () => {
    expect(extractErrorMessage({ error: { errors: ['Egy hiba.', 'Egy másik hiba.'] } }, 'fallback')).toBe(
      'Egy hiba. Egy másik hiba.',
    );
  });

  it('ValidationProblemDetails ({ errors: { field: string[] } }) alakú body esetén a mezőszintű üzeneteket adja vissza', () => {
    expect(
      extractErrorMessage(
        { error: { errors: { Name: ['A Name mező legfeljebb 255 karakter hosszú lehet.'] } } },
        'fallback',
      ),
    ).toBe('A Name mező legfeljebb 255 karakter hosszú lehet.');
  });

  it('413 státuszkód esetén a fájlméret-üzenetet adja vissza, a body-t figyelmen kívül hagyva', () => {
    expect(extractErrorMessage({ status: 413, error: '<html>...</html>' }, 'fallback')).toBe(
      'A feltöltött fájl mérete meghaladja a megengedett korlátot.',
    );
  });

  it('ismeretlen alakú body esetén a fallbacket adja vissza', () => {
    expect(extractErrorMessage({ error: {} }, 'fallback szöveg')).toBe('fallback szöveg');
    expect(extractErrorMessage({}, 'fallback szöveg')).toBe('fallback szöveg');
    expect(extractErrorMessage(null, 'fallback szöveg')).toBe('fallback szöveg');
  });

  it('valódi HttpErrorResponse esetén is a body errorMessage-ét adja vissza', () => {
    const err = new HttpErrorResponse({ status: 400, error: { errorMessage: 'Érvénytelen kód.' } });
    expect(extractErrorMessage(err, 'fallback')).toBe('Érvénytelen kód.');
  });

  it('valódi 413-as HttpErrorResponse esetén a fájlméret-üzenetet adja vissza', () => {
    const err = new HttpErrorResponse({ status: 413, error: '<html>413</html>' });
    expect(extractErrorMessage(err, 'fallback')).toBe('A feltöltött fájl mérete meghaladja a megengedett korlátot.');
  });

  it('nem HTTP-hiba és nem objektum bemenet esetén a fallbacket adja vissza', () => {
    expect(extractErrorMessage(undefined, 'fb')).toBe('fb');
    expect(extractErrorMessage('valami szöveg', 'fb')).toBe('fb');
    expect(extractErrorMessage(42, 'fb')).toBe('fb');
    expect(extractErrorMessage(new Error('net'), 'fb')).toBe('fb');
    expect(extractErrorMessage({ error: 'szöveges body' }, 'fb')).toBe('fb');
    expect(extractErrorMessage({ error: { errorMessage: '   ' } }, 'fb')).toBe('fb');
    expect(extractErrorMessage({ error: { errorMessage: 5, errors: [1, null, ''] } }, 'fb')).toBe('fb');
  });

  it('a fallback alapértéke "Hiba történt."', () => {
    expect(extractErrorMessage(null)).toBe('Hiba történt.');
  });
});

describe('isRecord', () => {
  it('csak nem-null objektumra igaz', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(1)).toBe(false);
  });
});
