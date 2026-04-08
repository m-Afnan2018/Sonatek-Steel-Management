'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import Spinner from '@/components/ui/Spinner/Spinner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '@/lib/api';
import { useProjects } from '@/hooks/useProjects';
import type { BurndownData, VelocityData, AttendanceSummary } from '@/types';
import styles from './reports.module.css';

const CHART_COLORS = ['#6C63FF', '#00D4AA', '#FFD32A', '#FF4757', '#8888A0'];

const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
};

export default function ReportsPage() {
  const { projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState('');
  const [burndown, setBurndown] = useState<BurndownData | null>(null);
  const [velocity, setVelocity] = useState<VelocityData[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]._id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError('');
      try {
        const requests = [
          api.get('/reports/velocity'),
          api.get('/reports/attendance-summary'),
        ];

        if (selectedProject) {
          requests.push(api.get('/reports/burndown', { params: { projectId: selectedProject } }));
        }

        const results = await Promise.all(requests);
        setVelocity(results[0].data);
        setAttendanceSummary(results[1].data);
        if (results[2]) setBurndown(results[2].data);
      } catch {
        setError('Failed to load reports. Please try again.');
      }
      setLoading(false);
    };
    fetchReports();
  }, [selectedProject]);

  // Task status donut data from burndown
  const statusData = burndown ? [
    { name: 'Remaining', value: burndown.data[burndown.data.length - 1]?.remaining || 0 },
    { name: 'Completed', value: burndown.totalTasks - (burndown.data[burndown.data.length - 1]?.remaining || 0) },
  ] : [];

  return (
    <AppShell title="Reports">
      <div className={styles.page}>
        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : error ? (
          <div className={styles.error}><p>{error}</p></div>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Burndown Chart</h2>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className={styles.select}
                >
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className={styles.chart}>
                {burndown && burndown.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={burndown.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="remaining" stroke="#FF4757" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="ideal" stroke="#6C63FF" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.empty}>No burndown data available</p>
                )}
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Task Completion</h2>
                <div className={styles.chart}>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className={styles.empty}>No data</p>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Sprint Velocity</h2>
                <div className={styles.chart}>
                  {velocity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={velocity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="week" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="completed" fill="#6C63FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className={styles.empty}>No velocity data</p>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Attendance Trend</h2>
              <div className={styles.chart}>
                {attendanceSummary && attendanceSummary.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={attendanceSummary.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                      />
                      <Legend />
                      <Bar dataKey="present" fill="#00D4AA" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="absent" fill="#FF4757" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="leave" fill="#FFD32A" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={styles.empty}>No attendance data</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
