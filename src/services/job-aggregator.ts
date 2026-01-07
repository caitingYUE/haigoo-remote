import { Job, SyncStatus, JobFilter, JobCategory } from '../types/rss-types';

class JobAggregator {
  private jobs: Job[] = [];
  private syncStatus: SyncStatus = {
    isRunning: false,
    lastSync: null,
    nextSync: null,
    totalSources: 0,
    successfulSources: 0,
    failedSources: 0,
    totalJobsProcessed: 0,
    newJobsAdded: 0,
    updatedJobs: 0,
    errors: []
  };

  /**
   * @deprecated Frontend sync is disabled. Use DataManagementService.syncAllRSSData instead.
   */
  async syncAllJobs(): Promise<void> {
    console.warn('JobAggregator.syncAllJobs is deprecated. Use DataManagementService.syncAllRSSData instead.');
  }

  getJobs(filter?: JobFilter): Job[] {
    return [];
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  async updateJobStatus(jobId: string, status: Job['status']): Promise<boolean> {
    return false;
  }

  deleteJob(jobId: string): boolean {
    return false;
  }

  async updateJobFeaturedStatus(jobId: string, isFeatured: boolean): Promise<boolean> {
    return false;
  }

  async updateJobApprovalStatus(jobId: string, isApproved: boolean): Promise<boolean> {
      return false;
  }

  async updateJobInternalData(jobId: string, data: any): Promise<boolean> {
      return false;
  }
  
  batchUpdateCategory(jobIds: string[], category: JobCategory): number {
      return 0;
  }
}

export const jobAggregator = new JobAggregator();
