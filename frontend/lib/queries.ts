'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  USE_MOCK,
  createCompany,
  fetchCompany,
  fetchCompanyOptions,
  fetchEvidence,
  fetchMe,
  fetchOnboardingStatus,
  fetchTender,
  fetchTenders,
  patchCompany,
} from './api';
import { useAuthToken } from './auth';
import type { CompanyPatch, CompanyProfile } from './types';

export const qk = {
  tenders: ['tenders'] as const,
  tender: (id: string) => ['tender', id] as const,
  company: ['company'] as const,
  evidence: ['evidence'] as const,
  me: ['me'] as const,
  companyOptions: ['company-options'] as const,
  onboardingStatus: ['onboarding-status'] as const,
};

export function useTenders() {
  return useQuery({ queryKey: qk.tenders, queryFn: fetchTenders });
}

export function useTender(externalId: string, enabled = true) {
  return useQuery({
    queryKey: qk.tender(externalId),
    queryFn: () => fetchTender(externalId),
    enabled: enabled && externalId.length > 0,
  });
}

export function useCompany() {
  return useQuery({ queryKey: qk.company, queryFn: fetchCompany });
}

export function useEvidence() {
  return useQuery({ queryKey: qk.evidence, queryFn: fetchEvidence });
}

/** Session identity. Real mode waits for a stored token first. */
export function useMe(enabled = true) {
  const token = useAuthToken();
  return useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    enabled: enabled && (USE_MOCK || token !== null),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useCompanyOptions() {
  return useQuery({
    queryKey: qk.companyOptions,
    queryFn: fetchCompanyOptions,
    staleTime: 30 * 60_000,
  });
}

export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: qk.onboardingStatus,
    queryFn: fetchOnboardingStatus,
    enabled,
    retry: false,
  });
}

function useInvalidateCompany() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: qk.company }),
      client.invalidateQueries({ queryKey: qk.onboardingStatus }),
      client.invalidateQueries({ queryKey: qk.me }),
    ]);
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (patch: CompanyPatch & { name: string }) => createCompany(patch),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function usePatchCompany() {
  const client = useQueryClient();
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (patch: CompanyPatch) => patchCompany(patch),
    onSuccess: (profile: CompanyProfile) => {
      client.setQueryData(qk.company, profile);
      void invalidate();
    },
  });
}
