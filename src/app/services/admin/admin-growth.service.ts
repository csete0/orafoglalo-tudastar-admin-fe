import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GrowthCancellations, GrowthCohort, GrowthOverview, ReferralReport, RevenueReport, TrialFunnel, UnitEconomics,
} from '../../models/growth.model';
import { ExamOutcomeQuote, ExamOutcomeSummary } from '../../models/exam-outcomes.model';

/** Növekedés-mérés és érettségi-eredmények - az admin két oldala. */
@Injectable({ providedIn: 'root' })
export class AdminGrowthService {
  private readonly http = inject(HttpClient);
  private readonly growth = `${environment.apiUrl}/growth`;
  private readonly outcomes = `${environment.apiUrl}/exam-outcomes`;

  getOverview(): Observable<GrowthOverview> {
    return this.http.get<GrowthOverview>(`${this.growth}/overview`);
  }

  getCohorts(weeks: number): Observable<GrowthCohort[]> {
    return this.http.get<GrowthCohort[]>(`${this.growth}/cohorts`, { params: new HttpParams().set('weeks', weeks) });
  }

  getCancellations(days: number): Observable<GrowthCancellations> {
    return this.http.get<GrowthCancellations>(`${this.growth}/cancellations`, { params: new HttpParams().set('days', days) });
  }

  getRevenue(months: number): Observable<RevenueReport> {
    return this.http.get<RevenueReport>(`${this.growth}/revenue`, { params: new HttpParams().set('months', months) });
  }

  getTrialFunnel(weeks: number): Observable<TrialFunnel> {
    return this.http.get<TrialFunnel>(`${this.growth}/trial-funnel`, { params: new HttpParams().set('weeks', weeks) });
  }

  getUnitEconomics(months: number): Observable<UnitEconomics> {
    return this.http.get<UnitEconomics>(`${this.growth}/unit-economics`, { params: new HttpParams().set('months', months) });
  }

  getReferrals(): Observable<ReferralReport> {
    return this.http.get<ReferralReport>(`${this.growth}/referrals`);
  }

  getOutcomeSummary(year: number | null): Observable<ExamOutcomeSummary> {
    const params = year === null ? new HttpParams() : new HttpParams().set('year', year);
    return this.http.get<ExamOutcomeSummary>(`${this.outcomes}/summary`, { params });
  }

  getQuotes(status: string): Observable<ExamOutcomeQuote[]> {
    return this.http.get<ExamOutcomeQuote[]>(`${this.outcomes}/quotes`, { params: new HttpParams().set('status', status) });
  }

  setQuoteStatus(id: number, approved: boolean): Observable<ExamOutcomeQuote> {
    return this.http.put<ExamOutcomeQuote>(`${this.outcomes}/quotes/${id}`, { approved });
  }

  /** CSV a hitelesített kéréssel (a JWT nem sütiben van, ezért nem sima link). */
  exportCsv(year: number): Observable<Blob> {
    return this.http.get(`${this.outcomes}/export`, { params: new HttpParams().set('year', year), responseType: 'blob' });
  }
}
