'use client';

import { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import ProjectCard from '@/components/projects/ProjectCard/ProjectCard';
import CreateProjectModal from '@/components/projects/CreateProjectModal/CreateProjectModal';
import Button from '@/components/ui/Button/Button';
import Spinner from '@/components/ui/Spinner/Spinner';
import { useProjects } from '@/hooks/useProjects';
import { useTeam } from '@/hooks/useTeam';
import { useAuthStore } from '@/store/authStore';
import styles from './projects.module.css';

export default function ProjectsPage() {
  const { projects, loading, createProject } = useProjects();
  const { members } = useTeam();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const canCreate = user?.role === 'admin' || user?.role === 'manager';

  const handleCreate = async (data: Record<string, unknown>) => {
    const project = await createProject(data as Parameters<typeof createProject>[0]);
    return project as { _id: string } | undefined;
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !p.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (priorityFilter && p.priority !== priorityFilter) return false;
      return true;
    });
  }, [projects, searchQuery, statusFilter, priorityFilter]);

  const hasFilters = searchQuery || statusFilter || priorityFilter;

  return (
    <AppShell title="Projects">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.filters}>
            <input
              className={styles.search}
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.select}
            >
              <option value="">All Status</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={styles.select}
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter(''); setPriorityFilter(''); }}>
                Clear
              </Button>
            )}
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              + New Project
            </Button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Spinner size="lg" />
          </div>
        ) : (
          <div className={styles.grid}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
            {filteredProjects.length === 0 && (
              <p className={styles.empty}>
                {hasFilters ? 'No projects match your filters.' : 'No projects found. Create your first project to get started.'}
              </p>
            )}
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        members={members}
      />
    </AppShell>
  );
}
