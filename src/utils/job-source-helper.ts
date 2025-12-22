import { Job } from '../types';

export type JobSourceType = 'referral' | 'official' | 'trusted_platform' | 'unknown';

export const getJobSourceType = (job: Job): JobSourceType => {
    if (job.canRefer) return 'referral';
    // 官网直投：jobs.is_trusted = true 或 jobs.source_type = 'official'
    if (job.isTrusted || job.sourceType === 'official') return 'official';
    // 第三方投递：jobs.source_type = 'trusted' (可信平台)
    if (job.sourceType === 'trusted') return 'trusted_platform';
    
    // Fallback logic for legacy/unknown data
    if (job.sourceType === 'rss' || job.sourceType === 'third-party' || (job.source && !job.isTrusted && !job.canRefer)) {
        return 'trusted_platform';
    }
    return 'unknown';
};

export const getJobSourceLabel = (type: JobSourceType): string => {
    switch (type) {
        case 'referral': return 'Haigoo 内推';
        case 'official': return '企业官网岗位';
        case 'trusted_platform': return '可信平台投递';
        default: return '';
    }
};

export const getJobSourceDescription = (type: JobSourceType): string => {
    switch (type) {
        case 'referral': return '由 Haigoo 审核简历并转递给企业，提高有效曝光率（会员专属）';
        case 'official': return '通过公司官网直接投递，Haigoo 已人工核实企业真实性';
        case 'trusted_platform': return '来自成熟招聘平台，Haigoo 已确认中国候选人可申请';
        default: return '';
    }
};
