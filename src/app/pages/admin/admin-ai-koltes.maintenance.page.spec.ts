import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeHu from '@angular/common/locales/hu';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminAiKoltesComponent } from './admin-ai-koltes.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { ToastService } from '../../shared/toast/toast.service';
import {
  AutomationStatusDto,
  QuizMaintenanceDecisionDto,
  QuizMaintenanceRunDto,
  QuizMaintenanceRunPageDto,
} from '../../models/ai-spending.model';

registerLocaleData(localeHu);

const HEADER =
  'Platform-admin AI-költés és automatizmusok Minden AI-hívás (OpenRouter) kérésenkénti költsége, a saját és az automata ' +
  'felhasználás, valamint a token-fogyasztó háttérfolyamatok kézi indítása egy helyen. Áttekintés Havi riport Kérésnapló ' +
  'Kvíz-karbantartás Eredmények kezelése Egyéb automatizmusok';

const NOTICE =
  'Az automatikus ütemezés eltávolítva. A kvíz-kérdés karbantartás korábban 2 naponta, 03:00-kor magától lefutott - ez ' +
  'mostantól kizárólag innen, kézzel indítható.';
const FORM =
  'Új futtatás indítása Kérdés-tartomány kezdete Kérdés-tartomány vége Modell openai/gpt-4o-mini (olcsó, alap) ' +
  'openai/gpt-4o (pontosabb) Mód Próbafuttatás (dry-run, nem ír adatot) Éles futtatás';
const HISTORY = 'Futtatási előzmények Kézi és korábbi automata futások.';

function run(overrides: Partial<QuizMaintenanceRunDto> = {}): QuizMaintenanceRunDto {
  return {
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    startedAt: '2026-10-20T08:05:00',
    completedAt: '2026-10-20T08:09:00',
    triggeredByUserId: 3,
    triggeredByName: 'Admin Ádám',
    rangeStartId: 100,
    rangeEndId: 200,
    model: 'openai/gpt-4o-mini',
    dryRun: true,
    candidatesReviewed: 42,
    estimatedCostUsd: 0.0412,
    errorMessage: null,
    ...overrides,
  };
}
const runs: QuizMaintenanceRunDto[] = [
  run(),
  run({
    id: 'bbbbbbbb-2222', startedAt: '2026-10-19T03:00:00', completedAt: null, triggeredByUserId: null, triggeredByName: null,
    rangeStartId: null, rangeEndId: null, dryRun: false, candidatesReviewed: 0, estimatedCostUsd: null,
  }),
  run({ id: 'cccccccc-3333', candidatesReviewed: 3, estimatedCostUsd: null, errorMessage: 'OpenRouter 502', dryRun: false }),
];
const page = (items: QuizMaintenanceRunDto[]): QuizMaintenanceRunPageDto => ({ items, totalCount: items.length });

function decision(overrides: Partial<QuizMaintenanceDecisionDto> = {}): QuizMaintenanceDecisionDto {
  return {
    questionId: 1,
    action: 'NoAction',
    oldQuestionText: 'Régi szöveg',
    newQuestionText: null,
    oldCorrectAnswer: null,
    newCorrectAnswer: null,
    reasoning: null,
    isTeacherOwned: false,
    teacherName: null,
    ...overrides,
  };
}
const decisions: QuizMaintenanceDecisionDto[] = [
  decision({ questionId: 11, action: 'Fixed', oldQuestionText: 'Mennyi 2+2?', newQuestionText: 'Mennyi 2 + 2?', reasoning: 'Formázás.' }),
  decision({ questionId: 12, action: 'Deactivated', oldQuestionText: 'Elavult kérdés' }),
  decision({ questionId: 13, action: 'FlaggedForTeacher', oldQuestionText: 'Tanári kérdés', isTeacherOwned: true, teacherName: 'Kovács Kata' }),
  decision({ questionId: 14, action: 'Fixed', oldQuestionText: 'Mennyi 3+3?' }),
];

const automations: AutomationStatusDto[] = [
  { key: 'studyplan', lastRunAt: '2026-10-21T02:00:00', lastRunCostUsd: 0.25, scheduleDescription: 'naponta 02:00' },
  { key: 'dailychallenge', lastRunAt: null, lastRunCostUsd: null, scheduleDescription: 'naponta 04:00' },
  { key: 'mas', lastRunAt: '2026-10-21T05:00:00', lastRunCostUsd: null, scheduleDescription: 'hetente' },
];

/**
 * Karakterizáció (a WP-C2b szétbontás előtt, a régi kódon rögzítve; utána változatlan elvárásokkal): a Kvíz-karbantartás,
 * az Eredmények kezelése és az Egyéb automatizmusok fül a valódi service-szel + HttpTestingController, hamis órával
 * (a futás-figyelő 8 mp-es, legfeljebb 20 próbálkozásos pollja miatt).
 */
describe('AdminAiKoltesComponent – karbantartás, eredmények, automatizmusok (teljes oldal)', () => {
  let fixture: ComponentFixture<AdminAiKoltesComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let confirmAsk: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.spyOn>;
  let toastDanger: ReturnType<typeof vi.spyOn>;

  const text = (root: Element = el) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  };
  /** A fülsor alatti tartalom (és a modal) szövege. */
  const body = () => {
    const all = text();
    expect(all.startsWith(HEADER + ' ')).toBe(true);
    return all.slice(HEADER.length + 1);
  };
  const isPath = (path: string) => (r: { url: string }) => r.url.endsWith(path);
  const req = (path: string, method = 'GET'): TestRequest =>
    http.expectOne((r) => r.url.endsWith(path) && r.method === method);
  const noReq = (path: string) => http.expectNone(isPath(path));
  async function settle() {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }
  async function wait(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }
  const button = (label: string): HTMLButtonElement => {
    const b = [...el.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent?.trim() === label);
    if (!b) throw new Error(`Nincs gomb: ${label}`);
    return b;
  };
  async function click(label: string) {
    button(label).click();
    await settle();
  }
  const fail = (r: TestRequest, errorMessage?: string) =>
    r.flush(errorMessage ? { errorMessage } : null, { status: 500, statusText: 'Server Error' });
  const inputs = () => [...el.querySelectorAll<HTMLInputElement>('input.input')];
  const selects = () => [...el.querySelectorAll<HTMLSelectElement>('select.input')];
  async function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }
  async function choose(select: HTMLSelectElement, index: number) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
    await settle();
  }
  const checkboxes = () => [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const radios = () => [...el.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  async function openMaintenance(items: QuizMaintenanceRunDto[] = runs) {
    await click('Kvíz-karbantartás');
    req('/quiz-maintenance/runs').flush(page(items));
    await settle();
  }
  async function openDecisions(items: QuizMaintenanceDecisionDto[] = decisions) {
    await openMaintenance();
    el.querySelectorAll<HTMLButtonElement>('.card.divide-y button')[0].click();
    await settle();
    req('/quiz-maintenance/runs/aaaaaaaa-1111-2222-3333-444444444444/decisions').flush(items);
    await settle();
  }
  async function startRun() {
    await click('Futtatás indítása');
    req('/quiz-maintenance/run', 'POST').flush({ runId: 'new-run', candidatesReviewed: 0, dryRun: true });
    await settle();
    req('/quiz-maintenance/runs').flush(page(runs));
    await settle();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    confirmAsk = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [AdminAiKoltesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask: confirmAsk } }],
    });
    http = TestBed.inject(HttpTestingController);
    const toast = TestBed.inject(ToastService);
    toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => undefined);
    toastDanger = vi.spyOn(toast, 'danger').mockImplementation(() => undefined);
    fixture = TestBed.createComponent(AdminAiKoltesComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
    http.match((r) => r.url.includes('/ai-spending/')).forEach((r) => r.flush(null));
    await settle();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  // ── Kvíz-karbantartás ────────────────────────────────────────────

  it('a karbantartás fül első megnyitáskor tölti az előzményeket (spinnerrel), utána fülváltáskor nem', async () => {
    noReq('/quiz-maintenance/runs');
    await click('Kvíz-karbantartás');
    const r = req('/quiz-maintenance/runs');
    expect(r.request.params.toString()).toBe('page=1&pageSize=20');
    expect(body()).toBe(`${NOTICE} ${FORM} Költség-becslés lekérése Futtatás indítása ${HISTORY} Betöltés…`);
    r.flush(page(runs));
    await settle();
    expect(body()).toBe(
      `${NOTICE} ${FORM} Költség-becslés lekérése Futtatás indítása ${HISTORY}` +
        ' #aaaaaaaa kézi próbafuttatás 2026.10.20. 08:05 · Admin Ádám · tartomány: 100–200 · 42 kérdés vizsgálva · $0.041 Eredmények' +
        ' #bbbbbbbb automata (archív) folyamatban… 2026.10.19. 03:00 · tartomány: alapértelmezett Eredmények' +
        ' #cccccccc kézi hiba 2026.10.20. 08:05 · Admin Ádám · tartomány: 100–200 · 3 kérdés vizsgálva OpenRouter 502 Eredmények',
    );
    const badges = [...el.querySelectorAll('.card.divide-y .badge')].map((b) => b.className);
    expect(badges).toEqual([
      'badge badge-primary', 'badge badge-warning',
      'badge badge-neutral', 'badge badge-primary',
      'badge badge-primary', 'badge badge-danger',
    ]);

    await click('Áttekintés');
    await click('Kvíz-karbantartás');
    noReq('/quiz-maintenance/runs');
    expect(body()).toContain('#aaaaaaaa kézi');
  });

  it('üres előzmény-listánál és betöltési hibánál „Még nem volt karbantartó-futás.”, toast nélkül', async () => {
    await click('Kvíz-karbantartás');
    fail(req('/quiz-maintenance/runs'), 'Hiba');
    await settle();
    expect(body()).toBe(`${NOTICE} ${FORM} Költség-becslés lekérése Futtatás indítása ${HISTORY} Még nem volt karbantartó-futás.`);
    expect(toastDanger).not.toHaveBeenCalled();
  });

  it('költség-becslés: a form adataival kér, betöltés közben „Becslés...”, bármely mező (a mód kivételével) változása törli', async () => {
    await openMaintenance();
    await type(inputs()[0], '500');
    await type(inputs()[1], '600');
    await choose(selects()[1], 1);
    await click('Költség-becslés lekérése');
    const r = req('/quiz-maintenance/estimate', 'POST');
    expect(r.request.body).toEqual({ rangeStartId: 500, rangeEndId: 600, model: 'openai/gpt-4o-mini' });
    expect(body()).toContain('Éles futtatás Becslés... Futtatás indítása');
    r.flush({ candidateCount: 10, estimatedCostUsd: 0.04 });
    await settle();
    expect(body()).toContain('Éles futtatás Becsült költség: $0.040 (10 kérdés · openai/gpt-4o-mini) Futtatás indítása');

    // A mód váltása nem törli a becslést.
    await choose(selects()[1], 0);
    expect(body()).toContain('Becsült költség: $0.040');
    // A modell váltása törli.
    await choose(selects()[0], 1);
    expect(body()).toContain('Éles futtatás Költség-becslés lekérése Futtatás indítása');
    await click('Költség-becslés lekérése');
    const r2 = req('/quiz-maintenance/estimate', 'POST');
    expect(r2.request.body).toEqual({ rangeStartId: 500, rangeEndId: 600, model: 'openai/gpt-4o' });
    r2.flush({ candidateCount: 8, estimatedCostUsd: 0.5 });
    await settle();
    // A tartomány változása is törli.
    expect(body()).toContain('Becsült költség: $0.500 (8 kérdés · openai/gpt-4o)');
    await type(inputs()[0], '');
    expect(body()).toContain('Költség-becslés lekérése');
  });

  it('becslési hibánál toast a backend üzenetével (üres formnál null tartománnyal kér), utána újra a lekérés-link', async () => {
    await openMaintenance();
    await click('Költség-becslés lekérése');
    const r = req('/quiz-maintenance/estimate', 'POST');
    expect(r.request.body).toEqual({ rangeStartId: null, rangeEndId: null, model: 'openai/gpt-4o-mini' });
    fail(r, 'Rossz tartomány.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Rossz tartomány.');
    expect(body()).toContain('Költség-becslés lekérése');
    await click('Költség-becslés lekérése');
    fail(req('/quiz-maintenance/estimate', 'POST'));
    await settle();
    expect(toastDanger).toHaveBeenLastCalledWith('A becslés lekérése sikertelen.');
  });

  it('futtatás: megerősítés (próba / éles szöveggel), elutasításnál nincs kérés', async () => {
    await openMaintenance();
    confirmAsk.mockResolvedValueOnce(false);
    await click('Futtatás indítása');
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message: 'Elindítod a próbafuttatást? Az eredmény csak megjelenik, az adatbázisba semmi nem íródik.',
      danger: false,
      confirmLabel: 'Futtatás indítása',
    });
    noReq('/quiz-maintenance/run');

    await choose(selects()[1], 1);
    confirmAsk.mockResolvedValueOnce(false);
    await click('Futtatás indítása');
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message: 'Elindítod az ÉLES kvíz-karbantartó futtatást? Ez valódi módosításokat végez a kérdésbankban.',
      danger: true,
      confirmLabel: 'Futtatás indítása',
    });
    noReq('/quiz-maintenance/run');
  });

  it('futtatás: a form adataival indít, közben „Indítás...” (tiltva), utána toast, előzmény-frissítés és 8 mp-es figyelés a befejezésig', async () => {
    await openMaintenance();
    await type(inputs()[0], '500');
    await type(inputs()[1], '600');
    await choose(selects()[1], 1);
    await click('Futtatás indítása');
    const r = req('/quiz-maintenance/run', 'POST');
    expect(r.request.body).toEqual({ rangeStartId: 500, rangeEndId: 600, model: 'openai/gpt-4o-mini', dryRun: false });
    expect(button('Indítás...').disabled).toBe(true);
    r.flush({ runId: 'new-run', candidatesReviewed: 0, dryRun: false });
    await settle();
    expect(button('Futtatás indítása').disabled).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith('Futtatás elindítva a háttérben - az eredmény a Futtatási előzményekben jelenik meg.');
    // Azonnali frissítés (spinnerrel).
    const reload = req('/quiz-maintenance/runs');
    expect(body()).toContain(`${HISTORY} Betöltés…`);
    reload.flush(page([run({ id: 'new-run', completedAt: null })]));
    await settle();
    expect(body()).toContain('#new-run kézi próbafuttatás folyamatban…');

    // 8 mp előtt nincs poll.
    await wait(7999);
    noReq('/quiz-maintenance/runs');
    await wait(1);
    const p1 = req('/quiz-maintenance/runs');
    expect(p1.request.params.toString()).toBe('page=1&pageSize=20');
    // A poll nem mutat spinnert.
    expect(body()).toContain('#new-run kézi próbafuttatás folyamatban…');
    p1.flush(page([run({ id: 'new-run', completedAt: null, candidatesReviewed: 5 })]));
    await settle();

    await wait(8000);
    req('/quiz-maintenance/runs').flush(page([run({ id: 'new-run', candidatesReviewed: 17 }), runs[1]]));
    await settle();
    expect(toastSuccess).toHaveBeenLastCalledWith('Futtatás kész: 17 kérdés átnézve.');
    expect(body()).toContain('#new-run kézi próbafuttatás 2026.10.20. 08:05 · Admin Ádám · tartomány: 100–200 · 17 kérdés vizsgálva');
    expect(body()).toContain('#bbbbbbbb automata (archív)');

    // Befejezés után nincs több poll.
    await wait(8000 * 25);
    noReq('/quiz-maintenance/runs');
  });

  it('a futtatás indítási hibájánál toast, a gomb újra aktív, nincs frissítés és poll', async () => {
    await openMaintenance();
    await click('Futtatás indítása');
    fail(req('/quiz-maintenance/run', 'POST'), 'Már fut egy karbantartás.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Már fut egy karbantartás.');
    expect(button('Futtatás indítása').disabled).toBe(false);
    await wait(8000 * 3);
    noReq('/quiz-maintenance/runs');
    await click('Futtatás indítása');
    fail(req('/quiz-maintenance/run', 'POST'));
    await settle();
    expect(toastDanger).toHaveBeenLastCalledWith('A futtatás indítása sikertelen.');
  });

  it('a poll legfeljebb 20-szor próbálkozik (a hibás válasz is egy próbálkozás), utána csendben leáll', async () => {
    await openMaintenance();
    await startRun();
    for (let i = 0; i < 20; i++) {
      await wait(8000);
      const r = req('/quiz-maintenance/runs');
      if (i % 2) fail(r);
      else r.flush(page([run({ id: 'new-run', completedAt: null })]));
      await settle();
    }
    await wait(8000 * 5);
    noReq('/quiz-maintenance/runs');
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastDanger).not.toHaveBeenCalled();
  });

  it('a poll a futás nélküli válasz után is folytatódik, és más fülön is fut', async () => {
    await openMaintenance();
    await startRun();
    await click('Áttekintés');
    await wait(8000);
    req('/quiz-maintenance/runs').flush(page([]));
    await settle();
    await wait(8000);
    req('/quiz-maintenance/runs').flush(page([run({ id: 'new-run', candidatesReviewed: 9 })]));
    await settle();
    expect(toastSuccess).toHaveBeenLastCalledWith('Futtatás kész: 9 kérdés átnézve.');
    await click('Kvíz-karbantartás');
    noReq('/quiz-maintenance/runs');
    expect(body()).toContain('#new-run kézi próbafuttatás');
  });

  it('új futtatás indításakor a korábbi poll leáll, az új a saját futását figyeli', async () => {
    await openMaintenance();
    await startRun();
    await wait(4000);
    await click('Futtatás indítása');
    req('/quiz-maintenance/run', 'POST').flush({ runId: 'second-run', candidatesReviewed: 0, dryRun: true });
    await settle();
    req('/quiz-maintenance/runs').flush(page(runs));
    await settle();
    await wait(4000);
    noReq('/quiz-maintenance/runs');
    await wait(4000);
    // A régi futás befejezése nem zárja le az új figyelését.
    req('/quiz-maintenance/runs').flush(page([run({ id: 'new-run' }), run({ id: 'second-run', completedAt: null })]));
    await settle();
    expect(toastSuccess).toHaveBeenCalledTimes(2);
    await wait(8000);
    req('/quiz-maintenance/runs').flush(page([run({ id: 'second-run', candidatesReviewed: 4 })]));
    await settle();
    expect(toastSuccess).toHaveBeenLastCalledWith('Futtatás kész: 4 kérdés átnézve.');
  });

  it('a pult megszűnésekor (várakozás közben) nincs több poll-kérés', async () => {
    await openMaintenance();
    await startRun();
    await wait(3000);
    fixture.destroy();
    await vi.advanceTimersByTimeAsync(8000 * 25);
    noReq('/quiz-maintenance/runs');
  });

  it('fülváltás után a form értékei és a becslés megmaradnak', async () => {
    await openMaintenance();
    await type(inputs()[0], '7');
    await choose(selects()[0], 1);
    await choose(selects()[1], 1);
    await click('Költség-becslés lekérése');
    req('/quiz-maintenance/estimate', 'POST').flush({ candidateCount: 3, estimatedCostUsd: 1.5 });
    await settle();
    await click('Egyéb automatizmusok');
    req('/automations/status').flush([]);
    await settle();
    await click('Kvíz-karbantartás');
    expect(inputs()[0].value).toBe('7');
    expect(inputs()[1].value).toBe('');
    expect(selects()[0].selectedIndex).toBe(1);
    expect(selects()[1].selectedIndex).toBe(1);
    expect(body()).toContain('Becsült költség: $1.50 (3 kérdés · openai/gpt-4o)');
  });

  // ── Eredmények kezelése ──────────────────────────────────────────

  it('az Eredmények fül futás nélkül csak a tippet mutatja', async () => {
    await click('Eredmények kezelése');
    expect(body()).toBe('Karbantartási eredmények Válassz egy futást a Kvíz-karbantartás fülön ("Eredmények" gomb).');
    noReq('/decisions');
  });

  it('az „Eredmények” gomb átvált az Eredmények fülre és betölti a futás döntéseit', async () => {
    await openMaintenance();
    el.querySelectorAll<HTMLButtonElement>('.card.divide-y button')[1].click();
    await settle();
    expect(el.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe('Eredmények kezelése');
    const r = req('/quiz-maintenance/runs/bbbbbbbb-2222/decisions');
    expect(r.request.params.toString()).toBe('');
    expect(body()).toBe(
      'Karbantartási eredmények Futás: #bbbbbbbb Mind (0) Javítva (0) Inaktiválva (0) Tanárnak jelölve (0)' +
        ' Helyettesítő hozzáadva (0) Nincs teendő (0) Jelölj ki 2 kérdést az összevonáshoz (0/2). Kijelöltek összevonása Betöltés…',
    );
    r.flush(decisions);
    await settle();
    expect(body()).toBe(
      'Karbantartási eredmények Futás: #bbbbbbbb Mind (4) Javítva (2) Inaktiválva (1) Tanárnak jelölve (1)' +
        ' Helyettesítő hozzáadva (0) Nincs teendő (0) Jelölj ki 2 kérdést az összevonáshoz (0/2). Kijelöltek összevonása' +
        ' Javítva közös bank Mennyi 2 + 2? Formázás. Törlés' +
        ' Inaktiválva közös bank Elavult kérdés Törlés' +
        ' Tanárnak jelölve Kovács Kata tanár kérdése Tanári kérdés Törlés' +
        ' Javítva közös bank Mennyi 3+3? Törlés',
    );
    const badges = [...el.querySelectorAll('.card.divide-y .badge')].map((b) => b.className);
    expect(badges).toEqual([
      'badge badge-success', 'badge badge-neutral', 'badge badge-danger', 'badge badge-neutral',
      'badge badge-warning', 'badge badge-neutral', 'badge badge-success', 'badge badge-neutral',
    ]);
    expect(button('Kijelöltek összevonása').disabled).toBe(true);
    expect(button('Mind (4)').classList.contains('!bg-bg-element')).toBe(true);
  });

  it('a szűrő-gombok az akció szerint szűrnek, üres szűrésnél üzenet', async () => {
    await openDecisions();
    await click('Javítva (2)');
    expect(button('Javítva (2)').classList.contains('!bg-bg-element')).toBe(true);
    expect(button('Mind (4)').classList.contains('!bg-bg-element')).toBe(false);
    expect(body()).toContain('Kijelöltek összevonása Javítva közös bank Mennyi 2 + 2? Formázás. Törlés Javítva közös bank Mennyi 3+3? Törlés');
    expect(body()).not.toContain('Elavult kérdés');
    await click('Nincs teendő (0)');
    expect(body()).toContain('Kijelöltek összevonása Nincs ebbe a szűrésbe eső döntés.');
    await click('Mind (4)');
    expect(body()).toContain('Elavult kérdés');
  });

  it('a döntések betöltési hibájánál toast; a lista üres marad', async () => {
    await openMaintenance();
    el.querySelectorAll<HTMLButtonElement>('.card.divide-y button')[0].click();
    await settle();
    fail(req('/quiz-maintenance/runs/aaaaaaaa-1111-2222-3333-444444444444/decisions'), 'Nincs ilyen futás.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Nincs ilyen futás.');
    expect(body()).toContain('Mind (0)');
    expect(body()).toContain('Nincs ebbe a szűrésbe eső döntés.');
  });

  it('összevonásra legfeljebb 2 kérdés jelölhető ki; 2-nél aktív a gomb', async () => {
    await openDecisions();
    checkboxes()[0].click();
    await settle();
    expect(body()).toContain('Jelölj ki 2 kérdést az összevonáshoz (1/2).');
    checkboxes()[2].click();
    await settle();
    expect(body()).toContain('2 kérdés kijelölve - összevonhatók.');
    expect(button('Kijelöltek összevonása').disabled).toBe(false);
    checkboxes()[3].click();
    await settle();
    expect(body()).toContain('2 kérdés kijelölve - összevonhatók.');
    checkboxes()[0].click();
    await settle();
    expect(body()).toContain('(1/2)');
    expect(checkboxes().map((c) => c.checked).slice(0, 3)).toEqual([false, false, true]);
  });

  it('összevonás-modal: az első kijelölt a megtartott, tanári duplikátumnál figyelmeztet, választható, Mégse/háttér zár', async () => {
    await openDecisions();
    checkboxes()[0].click();
    checkboxes()[2].click();
    await settle();
    await click('Kijelöltek összevonása');
    const modal = () => el.querySelector('.fixed.inset-0');
    expect(text(modal()!)).toBe(
      'Kérdések összevonása A megtartott kérdés marad a rendszerben, a duplikátum inaktiválódik.' +
        ' Megtartva: "Mennyi 2 + 2?" közös bank Duplikátum: "Tanári kérdés" Kovács Kata tanár kérdése' +
        ' Az egyik kérdés tanári tulajdon. A duplikátum nem törlődik, hanem inaktiválódik, és a tulajdonos tanár értesítést kap.' +
        ' Mégse Összevonás - tanár értesítése',
    );
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
    expect(modal()!.querySelector('.badge-warning')?.textContent?.trim()).toBe('Kovács Kata tanár kérdése');

    radios()[1].click();
    await settle();
    expect(text(modal()!)).toContain('Duplikátum: "Mennyi 2 + 2?" közös bank Megtartva: "Tanári kérdés"');
    expect(text(modal()!)).not.toContain('Az egyik kérdés tanári tulajdon.');

    // A kártyára kattintás nem zár.
    (modal()!.querySelector('.card') as HTMLElement).click();
    await settle();
    expect(modal()).not.toBeNull();
    await click('Mégse');
    expect(modal()).toBeNull();

    await click('Kijelöltek összevonása');
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
    (modal() as HTMLElement).click();
    await settle();
    expect(modal()).toBeNull();
    noReq('/quiz-maintenance/merge');
  });

  it('összevonás: a megtartott/duplikátum párral kér, „Összevonás...” közben, siker után zár, toast és a duplikátum eltűnik', async () => {
    await openDecisions();
    checkboxes()[0].click();
    checkboxes()[3].click();
    await settle();
    await click('Kijelöltek összevonása');
    radios()[1].click();
    await settle();
    await click('Összevonás - tanár értesítése');
    const r = req('/quiz-maintenance/merge', 'POST');
    expect(r.request.body).toEqual({ keepQuestionId: 14, duplicateQuestionId: 11 });
    expect(button('Összevonás...').disabled).toBe(true);
    r.flush({ teacherNotified: false });
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Kérdések összevonva.');
    expect(el.querySelector('.fixed.inset-0')).toBeNull();
    expect(body()).toContain('Mind (3) Javítva (1)');
    expect(body()).not.toContain('Mennyi 2 + 2?');
    expect(body()).toContain('(0/2)');
    expect(checkboxes().some((c) => c.checked)).toBe(false);
  });

  it('összevonás tanári értesítéssel más toastot ad; hibánál a modal nyitva marad', async () => {
    await openDecisions();
    checkboxes()[1].click();
    checkboxes()[2].click();
    await settle();
    await click('Kijelöltek összevonása');
    await click('Összevonás - tanár értesítése');
    fail(req('/quiz-maintenance/merge', 'POST'), 'Ütközés.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Ütközés.');
    expect(el.querySelector('.fixed.inset-0')).not.toBeNull();
    expect(button('Összevonás - tanár értesítése').disabled).toBe(false);
    await click('Összevonás - tanár értesítése');
    const r = req('/quiz-maintenance/merge', 'POST');
    expect(r.request.body).toEqual({ keepQuestionId: 12, duplicateQuestionId: 13 });
    r.flush({ teacherNotified: true });
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Összevonva - a tanár értesítést kapott.');
    expect(body()).not.toContain('Tanári kérdés');
    expect(body()).toContain('Elavult kérdés');
  });

  it('összevonási hiba üzenet nélkül: általános toast', async () => {
    await openDecisions();
    checkboxes()[1].click();
    checkboxes()[2].click();
    await settle();
    await click('Kijelöltek összevonása');
    await click('Összevonás - tanár értesítése');
    fail(req('/quiz-maintenance/merge', 'POST'));
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Az összevonás sikertelen.');
  });

  it('törlés: megerősítés után inaktivál, eltávolítja a listából és a kijelölésből; elutasításnál nincs kérés', async () => {
    await openDecisions();
    checkboxes()[1].click();
    checkboxes()[2].click();
    await settle();
    confirmAsk.mockResolvedValueOnce(false);
    el.querySelectorAll<HTMLButtonElement>('.btn-danger')[1].click();
    await settle();
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message: 'Inaktiválod ezt a kérdést? A közös bankban/kvízben többé nem jelenik meg diákoknak.',
      danger: true,
      confirmLabel: 'Inaktiválás',
    });
    noReq('/quiz-maintenance/questions/12');

    el.querySelectorAll<HTMLButtonElement>('.btn-danger')[1].click();
    await settle();
    req('/quiz-maintenance/questions/12', 'DELETE').flush(null);
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Kérdés inaktiválva.');
    expect(body()).not.toContain('Elavult kérdés');
    expect(body()).toContain('Mind (3)');
    expect(body()).toContain('(1/2)');
    expect(checkboxes().map((c) => c.checked)).toEqual([false, true, false]);

    el.querySelectorAll<HTMLButtonElement>('.btn-danger')[0].click();
    await settle();
    fail(req('/quiz-maintenance/questions/11', 'DELETE'), 'Nem törölhető.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Nem törölhető.');
    expect(body()).toContain('Mennyi 2 + 2?');
    el.querySelectorAll<HTMLButtonElement>('.btn-danger')[0].click();
    await settle();
    fail(req('/quiz-maintenance/questions/11', 'DELETE'));
    await settle();
    expect(toastDanger).toHaveBeenLastCalledWith('Az inaktiválás sikertelen.');
  });

  it('fülváltás után a döntések, a szűrő és a kijelölés megmarad; másik futás megnyitása mindent visszaállít és újratölt', async () => {
    await openDecisions();
    await click('Javítva (2)');
    checkboxes()[0].click();
    await settle();
    await click('Kvíz-karbantartás');
    await click('Eredmények kezelése');
    noReq('/decisions');
    expect(button('Javítva (2)').classList.contains('!bg-bg-element')).toBe(true);
    expect(body()).toContain('(1/2)');

    await click('Kvíz-karbantartás');
    el.querySelectorAll<HTMLButtonElement>('.card.divide-y button')[0].click();
    await settle();
    // Ugyanaz a futás is újratölt; közben a régi lista mögött spinner.
    expect(body()).toContain('Mind (4)');
    expect(body()).toContain('(0/2)');
    expect(button('Mind (4)').classList.contains('!bg-bg-element')).toBe(true);
    req('/quiz-maintenance/runs/aaaaaaaa-1111-2222-3333-444444444444/decisions').flush([decision({ questionId: 99 })]);
    await settle();
    expect(body()).toContain('Mind (1)');
    expect(body()).toContain('Nincs teendő közös bank Régi szöveg Törlés');
  });

  // ── Egyéb automatizmusok ─────────────────────────────────────────

  it('az automatizmus fül első megnyitáskor tölt (spinnerrel), utána fülváltáskor nem', async () => {
    noReq('/automations/status');
    await click('Egyéb automatizmusok');
    const r = req('/automations/status');
    const intro =
      'Token-fogyasztó háttérfolyamatok A projektben jelenleg ez a 2 ütemezett feladat + 1 tanár-indított funkció éget ' +
      'AI-tokent az automata kvíz-karbantartáson kívül.';
    const outro = 'Ha a projektbe új, tokent fogyasztó háttérfolyamat kerül, ide kell felvenni - nincs ehhez automatikus felismerés.';
    expect(body()).toBe(`${intro} Betöltés… ${outro}`);
    r.flush(automations);
    await settle();
    expect(body()).toBe(
      `${intro}` +
        ' ⏱ Tanulási terv újraszámítás naponta 02:00 Utoljára lefutott: 2026.10.21. 02:00 · $0.250 Kézi újraindítás most' +
        ' ⏱ Napi kihívás előgenerálás naponta 04:00 Még nem futott le AiRequestLog-bejegyzés szerint. Kézi újraindítás most' +
        ' ⏱ mas hetente Utoljára lefutott: 2026.10.21. 05:00 Kézi újraindítás most' +
        ' ✎ Kvíz-kérdés generálás (tanári) nem ütemezett - tanár indítja Nem háttérfolyamat, tanári kérésre fut - a költése a' +
        ' Kérésnaplóban szűrhető ("Kvíz-generálás (tanári)"), kézi indítás innen nem értelmezhető.' +
        ` ${outro}`,
    );
    await click('Áttekintés');
    await click('Egyéb automatizmusok');
    noReq('/automations/status');
    expect(body()).toContain('Tanulási terv újraszámítás');
  });

  it('betöltési hibánál csak a tanári kártya marad, toast nélkül', async () => {
    await click('Egyéb automatizmusok');
    fail(req('/automations/status'));
    await settle();
    expect(body()).toContain('AI-tokent az automata kvíz-karbantartáson kívül. ✎ Kvíz-kérdés generálás (tanári)');
    expect(toastDanger).not.toHaveBeenCalled();
  });

  it('kézi indítás: megerősítés a címmel, a megfelelő végpont, közben „Indítás...” (tiltva), siker után toast és frissítés', async () => {
    await click('Egyéb automatizmusok');
    req('/automations/status').flush(automations);
    await settle();
    const triggers = () => [...el.querySelectorAll<HTMLButtonElement>('.card button')];

    confirmAsk.mockResolvedValueOnce(false);
    triggers()[0].click();
    await settle();
    expect(confirmAsk).toHaveBeenLastCalledWith({
      message: 'Elindítod a(z) "Tanulási terv újraszámítás" folyamatot kézzel, most?',
      confirmLabel: 'Indítás',
    });
    noReq('/trigger');

    triggers()[0].click();
    await settle();
    const r = req('/automations/study-plan/trigger', 'POST');
    expect(r.request.body).toEqual({});
    expect(triggers().map((b) => [b.textContent?.trim(), b.disabled])).toEqual([
      ['Indítás...', true], ['Kézi újraindítás most', false], ['Kézi újraindítás most', false],
    ]);
    r.flush({ message: 'Tanulási terv elindítva.' });
    await settle();
    expect(toastSuccess).toHaveBeenCalledWith('Tanulási terv elindítva.');
    // Frissítés spinnerrel.
    const reload = req('/automations/status');
    expect(body()).toContain('Betöltés…');
    reload.flush(automations.slice(1));
    await settle();
    expect(body()).not.toContain('Tanulási terv újraszámítás');

    triggers()[0].click();
    await settle();
    expect(confirmAsk).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Elindítod a(z) "Napi kihívás előgenerálás" folyamatot kézzel, most?' }));
    fail(req('/automations/daily-challenge/trigger', 'POST'), 'Már fut.');
    await settle();
    expect(toastDanger).toHaveBeenCalledWith('Már fut.');
    expect(triggers()[0].disabled).toBe(false);
    noReq('/automations/status');

    // Ismeretlen kulcs: a napi kihívás végpontja (a régi viselkedés), a címe maga a kulcs.
    triggers()[1].click();
    await settle();
    expect(confirmAsk).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Elindítod a(z) "mas" folyamatot kézzel, most?' }));
    fail(req('/automations/daily-challenge/trigger', 'POST'));
    await settle();
    expect(toastDanger).toHaveBeenLastCalledWith('A folyamat indítása sikertelen.');
  });
});
