import React, { useState, useEffect } from "react";
import { MapPin, Plus, X, Check, Telescope, LocateFixed } from "lucide-react";
import { flaskFetch } from './api';
import type { CommunityReport } from "./types";
import { Pager } from "./Pager";
import { NearbyReports } from "./NearbyReports";
import { locationErrorMessage } from "./useGeolocation";

/**
 * Data structure for raw JSON results from /api/reports
 * @see {@link ../../../app/routes/reports.py}
 */
type ReportsData = {
  data: CommunityReport[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Data to send in a POST request to make a new community report.
 * @see {@link ../../../app/routes/reports.py}
 */
type NewReportPayload = {
  user_id?: number;
  latitude?: string | number;
  longitude?: string | number;
  report_text: string;
};

type CreateReportResponse = {
  data: CommunityReport;
};

interface CommunityReportsProps {
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  latitude?: string | number;
  longitude?: string | number;
  currentUserID?: number;
  onSetLatitude: (value: string) => void;
  onSetLongitude: (value: string) => void;
  onRequestLocation: () => void;
  locating: boolean;
  locationError: { code: number; message: string } | null;
}

export function CommunityReports({
  isLoggedIn,
  onLoginRequired,
  latitude,
  longitude,
  currentUserID,
  onSetLatitude,
  onSetLongitude,
  onRequestLocation,
  locating,
  locationError
}: CommunityReportsProps) {
  const [showForm, setShowForm] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [page, setPage]  = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [creatingReport, setCreatingReport] = useState(false);
  const [reportText, setReportText] = useState('');
  // "nearby" swaps the list below for the advanced-query view. Posting a
  // report works from either.
  const [view, setView] = useState<'all' | 'nearby'>('all');

  const handleCreateReport = async (payload: NewReportPayload) => {
    setCreatingReport(true);
    try {
      const result = await flaskFetch<CreateReportResponse>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setReports((prev) => [result.data, ...prev]);
      setTotalReports((prev) => prev + 1);

      return result.data;
    } catch (error) {
      console.error('Failed to create community report:', error);
      throw error;
    } finally {
      setCreatingReport(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    // A report with no coordinates can never be found by the Nearby view, so
    // it is worth stopping here rather than storing something unreachable.
    if (latitude === '' || latitude === undefined
      || longitude === '' || longitude === undefined) {
      setFormError('Enter a latitude and longitude first.');
      return;
    }

    try {
      await handleCreateReport({
        user_id: currentUserID,
        latitude,
        longitude,
        report_text: reportText,
      });
      setReportText('');
      setShowForm(false);
    } catch (error) {
      // The form stays open so the user can retry.
      setFormError(
        error instanceof Error ? error.message : 'Could not post that report.'
      );
    }
  }

  const handleFetchReports = async (page?: number) => {
    setLoadingReports(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));

      const results = await flaskFetch<ReportsData>(`/api/reports?${params.toString()}`);
      setReports(results.data);
      setPage(results.page);
      setTotalReports(results.total);
      setPageSize(results.limit);
    } catch (error) {
      console.error('Failed to fetch community reports:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load reports.'
      );
    } finally {
      setLoadingReports(false);
    }
  };

  // Only fetch all community reports when this component mounts.
  useEffect(() => {
    handleFetchReports(1);
  }, [])

  // Close the in-progress report form if the user signs out mid-draft.
  useEffect(() => {
    if (!isLoggedIn) {
      setShowForm(false);
      setReportText('');
    }
  }, [isLoggedIn])

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">Community Viewing Reports</h1>
          <p className="text-sm">
            Light pollution, seeing conditions, and viewing notes from observers worldwide.
          </p>
        </div>
        <button className="btn btn-warning"
          onClick={() => {
            if (!isLoggedIn) { onLoginRequired(); return; }
            setShowForm(true);
          }}
        >
          <Plus className="size-[1.2em]" /> Add Report
        </button>
      </div>

      {/* Add new report form */}
      {showForm && (
        <div className="card card-border bg-base-200 border-warning/50">
          <div className="card-body">
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title">New Community Report</h2>
              <button onClick={() => setShowForm(false)}
                className="btn btn-square btn-soft"
              >
                <X className="size-[1.2em]" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <input type="hidden" name="UserID" value={currentUserID ?? ''} />
              {/* Lat/Lon inputs */}
              <div className="flex gap-4 flex-wrap items-end">
                <div className="flex flex-col gap-2">
                  <label className="label font-mono" htmlFor="lat">
                    Latitude
                  </label>
                  {/* String, not number: valueAsNumber is NaN for a half-typed
                    "-" or "40.", which wipes the box mid-entry. */}
                  <input type="number" id="lat" name="Latitude" value={latitude}
                    onChange={(e) => onSetLatitude(e.target.value)}
                    className="input focus-visible:input-warning"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="label font-mono" htmlFor="lon">
                    Longitude
                  </label>
                  <input type="number" id="lon" name="Longitude"
                    value={longitude}
                    onChange={(e) => onSetLongitude(e.target.value)}
                    className="input focus-visible:input-warning" />
                </div>
                <button type="button" className="btn btn-soft"
                  onClick={onRequestLocation} disabled={locating}
                >
                  <LocateFixed className="size-[1.2em]" />
                  {locating ? 'Locating...' : 'Use my location'}
                </button>
              </div>

              {(formError || locationError) && (
                <div role="alert" className="alert alert-error">
                  <span>
                    {formError ?? locationErrorMessage(locationError)}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2 w-full">
                <label className="label font-mono" htmlFor="report-text">
                  Observation Notes
                </label>
                <textarea id="report-text" name="ReportText" value={reportText}
                  onChange={(e) => { setReportText(e.target.value) }}
                  className="textarea w-full focus-visible:textarea-warning"
                  placeholder="Describe viewing conditions, objects seen, equipment used…"/>
              </div>

              {/* form actions: post report, cancel buttons */}
              <div className="card-actions">
                <button className="btn btn-primary"
                  type="submit" disabled={creatingReport}
                >
                  <Check className="size-[1.2em]" />
                  {creatingReport ? 'Posting...' : 'Post Report'}
                </button>
                <button className="btn btn-soft btn-error" type="button"
                  onClick={() => {setShowForm(false); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="join">
        <button
          onClick={() => setView('all')}
          className={`btn btn-sm join-item${view === 'all' ? ' btn-warning' : ' btn-soft'}`}
        >
          All reports
        </button>
        <button
          onClick={() => setView('nearby')}
          className={`btn btn-sm join-item${view === 'nearby' ? ' btn-warning' : ' btn-soft'}`}
        >
          Nearby
        </button>
      </div>

      {view === 'all' && totalReports > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-primary font-mono">
            {`${totalReports} community report${totalReports !== 1 ? 's' : ''}`}
          </p>
          <Pager currentPage={page}
            numberOfPages={Math.ceil(totalReports / pageSize)}
            onSetCurrentPage={
              (page: number) => {setPage(page); handleFetchReports(page); }}/>
        </div>
      )}

      {view === 'nearby' && (
        <NearbyReports latitude={latitude} longitude={longitude}
          onRequestLocation={onRequestLocation} locating={locating} />
      )}

      {view === 'all' && loadError && (
        <div role="alert" className="alert alert-error">
          <span>{loadError}</span>
        </div>
      )}

      {view === 'all' && !loadingReports && !loadError && !reports.length && (
        <div className="flex flex-col items-center gap-3 py-16 text-neutral-content">
          <Telescope size={32} className="opacity-40" />
          <p>No community reports yet. Be the first to post one.</p>
        </div>
      )}

      {/* List of Community Reports */}
      {view === 'all' && !loadingReports && reports.length ? (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <div key={report.ReportID}
              className="card card-border border-neutral bg-base-200"
            >
              <div className="card-body">
                <h2 className="card-title">
                  {/* Null once the author deletes their account -- the report
                    survives, the person doesn't. */}
                  {report.UserName ?? (
                    <span className="opacity-60">Deleted user</span>
                  )}
                  <span className="px-2 text-sm font-mono">
                    {report.CreatedAt.replace(/:00\s/, ' ')}
                  </span>
                </h2>
                <span className="badge badge-soft badge-primary badge-lg font-mono">
                  <MapPin className="size-[1.2em]" />
                  <span>
                    {report.Latitude.toFixed(2)}°{
                      report.Latitude > 0 ? 'N, '
                        : report.Latitude < 0 ? 'S, ' : ', '
                    }
                  </span>
                  <span>
                    {report.Longitude.toFixed(2)}°{
                      report.Longitude > 0 ? 'E'
                        : report.Longitude < 0 ? 'W' : ''
                    }
                  </span>
                </span>
                <div className="text-base">{report.ReportText}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        null
      )}
    </div>
  );
}
