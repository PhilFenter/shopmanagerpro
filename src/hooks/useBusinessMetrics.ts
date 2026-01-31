import { useMemo } from 'react';
import { useTeamMembers } from './useTeamMembers';
import { useOverheadItems } from './useOverheadItems';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const WORKING_DAYS_PER_MONTH = 22;
const WORKING_HOURS_PER_DAY = 8;
const WEEKS_PER_MONTH = 4.33;

export interface BusinessMetrics {
  monthlyLaborCost: number;
  payrollTaxBurden: number;
  totalLaborCostWithTaxes: number;
  monthlyOverheadCost: number;
  totalMonthlyCost: number;
  totalMonthlyHours: number;
  laborCostPerHour: number;
  overheadCostPerHour: number;
  totalCostPerHour: number;
  trueCostPerHour: number;
  payrollTaxRate: number;
}

export function useBusinessMetrics() {
  const { user, role } = useAuth();
  const { members } = useTeamMembers();
  const { totalMonthlyOverhead } = useOverheadItems();

  // Fetch payroll tax rate from business settings
  const settingsQuery = useQuery({
    queryKey: ['business-settings', 'payroll_tax_rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'payroll_tax_rate')
        .single();

      if (error) throw error;
      return (data?.value as { rate: number })?.rate ?? 0.165;
    },
    enabled: !!user && role === 'admin',
  });

  const payrollTaxRate = settingsQuery.data ?? 0.165;

  const metrics = useMemo((): BusinessMetrics => {
    let monthlyLaborCost = 0;
    let totalMonthlyHours = 0;

    members.forEach((member) => {
      const weeklyHours = member.weekly_hours ?? 40;
      const monthlyHours = weeklyHours * WEEKS_PER_MONTH;

      if (member.is_salary) {
        // Salary employee - use fixed monthly salary
        monthlyLaborCost += member.monthly_salary ?? 0;
      } else {
        // Hourly employee - calculate from rate and hours
        monthlyLaborCost += (member.hourly_rate ?? 0) * monthlyHours;
      }

      totalMonthlyHours += monthlyHours;
    });

    // Calculate payroll tax burden (employer portion)
    const payrollTaxBurden = monthlyLaborCost * payrollTaxRate;
    const totalLaborCostWithTaxes = monthlyLaborCost + payrollTaxBurden;

    // Monthly overhead costs (non-payroll)
    const monthlyOverheadCost = totalMonthlyOverhead;

    // Total monthly operating cost
    const totalMonthlyCost = totalLaborCostWithTaxes + monthlyOverheadCost;

    // Cost per hour calculations
    const laborCostPerHour = totalMonthlyHours > 0 ? monthlyLaborCost / totalMonthlyHours : 0;
    const overheadCostPerHour = totalMonthlyHours > 0 ? monthlyOverheadCost / totalMonthlyHours : 0;
    const totalCostPerHour = laborCostPerHour + overheadCostPerHour; // Job costing rate (no payroll taxes)
    const trueCostPerHour = totalMonthlyHours > 0 ? totalMonthlyCost / totalMonthlyHours : 0; // True cost including taxes

    return {
      monthlyLaborCost,
      payrollTaxBurden,
      totalLaborCostWithTaxes,
      monthlyOverheadCost,
      totalMonthlyCost,
      totalMonthlyHours,
      laborCostPerHour,
      overheadCostPerHour,
      totalCostPerHour,
      trueCostPerHour,
      payrollTaxRate,
    };
  }, [members, totalMonthlyOverhead, payrollTaxRate]);

  return {
    ...metrics,
    isLoading: settingsQuery.isLoading,
  };
}

/**
 * Calculate labor cost for a job based on time tracked
 */
export function calculateJobLaborCost(
  timeMinutes: number,
  laborCostPerHour: number
): number {
  return (timeMinutes / 60) * laborCostPerHour;
}

/**
 * Calculate overhead allocation for a job based on time tracked
 */
export function calculateJobOverhead(
  timeMinutes: number,
  overheadCostPerHour: number
): number {
  return (timeMinutes / 60) * overheadCostPerHour;
}

/**
 * Calculate complete job metrics
 */
export function calculateJobMetrics(
  salePrice: number,
  materialCost: number,
  timeMinutes: number,
  laborCostPerHour: number,
  overheadCostPerHour: number
) {
  const laborCost = calculateJobLaborCost(timeMinutes, laborCostPerHour);
  const overhead = calculateJobOverhead(timeMinutes, overheadCostPerHour);
  const totalCost = materialCost + laborCost + overhead;
  const profit = salePrice - totalCost;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  const totalTimeHours = timeMinutes / 60;
  const dollarsPerHour = totalTimeHours > 0 ? profit / totalTimeHours : 0;

  return {
    laborCost,
    overhead,
    totalCost,
    profit,
    margin,
    dollarsPerHour,
  };
}
