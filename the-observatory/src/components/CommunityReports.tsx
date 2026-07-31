import React, { useState, useEffect } from "react";
import { MapPin, Plus, X, Check } from "lucide-react";
import { flaskFetch } from './api';
import type { CommunityReport } from "./data";
import { Pager } from "./Pager";

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
  onSetLatitude: (value: number) => void;
  onSetLongitude: (value: number) => void;
}

export function CommunityReports({
  isLoggedIn,
  onLoginRequired,
  latitude,
  longitude,
  currentUserID,
  onSetLatitude,
  onSetLongitude
}: CommunityReportsProps) {
  const [showForm, setShowForm] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [page, setPage]  = useState(1);
  const [pageSize, setPageSize] = useState(48);
  const [creatingReport, setCreatingReport] = useState(false);
  const [reportText, setReportText] = useState('');

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

    try {
      await handleCreateReport({
        user_id: currentUserID,
        latitude,
        longitude,
        report_text: reportText,
      });
    } catch {
      // handleCreateReport already logs the error.
      // The form stays open so the user can retry.
    }
  }

  const handleFetchReports = async (page?: number) => {
    setLoadingReports(true);
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
    } finally {
      setLoadingReports(false);
    }
  };

  // Only fetch all community reports when this component mounts.
  useEffect(() => {
    handleFetchReports(1);
  }, [])

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
              <input type="hidden" name="UserID" value={currentUserID} />
              {/* Lat/Lon inputs */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                  <label className="label font-mono" htmlFor="lat">
                    Latitude
                  </label>
                  {/* TODO: latitude isn't changeable?? */}
                  <input type="number" id="lat" name="Latitude" value={latitude}
                    onChange={(e) => { onSetLatitude(e.target.valueAsNumber)}}
                    className="input focus-visible:input-warning"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="label font-mono" htmlFor="lon">
                    Longitude
                  </label>
                  <input type="number" id="lon" name="Longitude"
                    value={longitude}
                    onChange={(e) => { onSetLongitude(e.target.valueAsNumber) }}
                    className="input focus-visible:input-warning" />
                </div>
              </div>
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

      {totalReports > 0 && (
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

      {/* List of Community Reports */}
      {!loadingReports && reports.length ? (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <div key={report.ReportID}
              className="card card-border border-neutral bg-base-200"
            >
              <div className="card-body">
                <h2 className="card-title">
                  {report.UserName}
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
