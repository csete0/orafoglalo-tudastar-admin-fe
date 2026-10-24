import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AiKoltesRequestLogState } from './ai-koltes-request-log.state';
import { AdminAiSpendingService } from '../../../services/admin/admin-ai-spending.service';
import { AiRequestLogPageDto } from '../../../models/ai-spending.model';

describe('AiKoltesRequestLogState', () => {
  let getRequestLog: ReturnType<typeof vi.fn>;
  let state: AiKoltesRequestLogState;

  const page = (totalCount: number): AiRequestLogPageDto => ({ items: [], totalCount });
  async function flush() {
    TestBed.inject(ApplicationRef).tick();
    await new Promise((r) => setTimeout(r));
  }

  beforeEach(() => {
    getRequestLog = vi.fn().mockReturnValue(of(page(45)));
    TestBed.configureTestingModule({
      providers: [AiKoltesRequestLogState, { provide: AdminAiSpendingService, useValue: { getRequestLog } }],
    });
    state = TestBed.inject(AiKoltesRequestLogState);
  });

  it('a start() előtt nem tölt; utána egyszer, az 1. oldalt üres szűrővel', async () => {
    await flush();
    expect(getRequestLog).not.toHaveBeenCalled();
    state.start();
    state.start();
    await flush();
    expect(getRequestLog).toHaveBeenCalledTimes(1);
    expect(getRequestLog).toHaveBeenCalledWith({}, 1, 20);
    expect(state.rangeLabel()).toBe('1–20 / 45 kérés');
    expect(state.hasNextPage()).toBe(true);
  });

  it('szűrőváltás az 1. oldalra ugrik, a mezők összeadódnak; a törlés üres szűrővel újratölt', async () => {
    state.start();
    state.changePage(1);
    state.changePage(1);
    await flush();
    expect(getRequestLog).toHaveBeenLastCalledWith({}, 3, 20);

    state.setFilter({ userQuery: 'anna' });
    state.setFilter({ source: 'chat' });
    await flush();
    expect(getRequestLog).toHaveBeenLastCalledWith({ userQuery: 'anna', source: 'chat' }, 1, 20);

    const calls = getRequestLog.mock.calls.length;
    state.clearFilter();
    await flush();
    state.clearFilter();
    await flush();
    expect(getRequestLog).toHaveBeenCalledTimes(calls + 2);
    expect(getRequestLog).toHaveBeenLastCalledWith({}, 1, 20);
  });

  it('az oldalszám nem megy 1 alá; az utolsó oldalon nincs következő', async () => {
    state.start();
    state.changePage(-1);
    expect(state.page()).toBe(1);
    state.changePage(1);
    state.changePage(1);
    await flush();
    expect(state.rangeLabel()).toBe('41–45 / 45 kérés');
    expect(state.hasNextPage()).toBe(false);
  });

  it('új kérés indulásakor a korábbi (még futó) kérés lemondódik', async () => {
    const first = new Subject<AiRequestLogPageDto>();
    getRequestLog.mockReturnValueOnce(first);
    state.start();
    await flush();
    expect(first.observed).toBe(true);
    state.setFilter({ userQuery: 'b' });
    await flush();
    expect(first.observed).toBe(false);
    expect(state.loading()).toBe(false);
    expect(state.totalCount()).toBe(45);
  });
});
