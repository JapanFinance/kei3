import { describe, it, expect } from 'vitest'
import { calculateHealthInsurancePremium } from '../utils/healthInsuranceCalculator'
import { HealthInsuranceProvider, DEFAULT_PROVIDER_REGION } from '../types/healthInsurance'

const KYOKAI_KENPO_PROVIDER = HealthInsuranceProvider.KYOKAI_KENPO;
const ITS_KENPO_PROVIDER = HealthInsuranceProvider.ITS_KENPO;

describe('calculateHealthInsurancePremium for employees', () => {
  describe('Kyokai Kenpo (Tokyo)', () => {
      it('calculates premium for people under 40', () => {
        expect(calculateHealthInsurancePremium(5_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(243_792)
      })

      it('calculates employees health insurance premium for people under 40 with cap', () => {
        expect(calculateHealthInsurancePremium(20_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(826_500)
      })
    
      it('calculates employees health insurance premium with nursing care for people over 40', () => {
        expect(calculateHealthInsurancePremium(5_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(282_900)
      })
    
      it('calculates employees health insurance premium with nursing care for people over 40 with cap', () => {
        expect(calculateHealthInsurancePremium(20_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(959_100)
      })
    
      it('handles zero income correctly', () => {
        expect(calculateHealthInsurancePremium(0, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(34_488)
        expect(calculateHealthInsurancePremium(0, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toBe(40_020)
      })
    
      it('handles negative income correctly', () => {
        expect(() => calculateHealthInsurancePremium(-1_000_000, false, KYOKAI_KENPO_PROVIDER, "Tokyo")).toThrowError('Income cannot be negative.')
        expect(() => calculateHealthInsurancePremium(-1_000_000, true, KYOKAI_KENPO_PROVIDER, "Tokyo")).toThrowError('Income cannot be negative.')
      })
  });

  describe('ITS Kenpo (Default Region)', () => {
    // Annual income 5,000,000 / 12 = 416,666.67. SMR: 410,000円
    // Employee No LTC: 19,475. Employee With LTC: 19,475 + 3,690 (LTC for 410k) = 23,165
    it('calculates premium for people under 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(19475 * 12); // 233_700
    });

    // Annual income 20,000,000 / 12 = 1,666,666.67. SMR: 1,390,000円 (Max)
    // Employee No LTC: 66,025. Employee With LTC: 66,025 + 12,510 (LTC for 1.39M) = 78,535
    it('calculates premium for people under 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(66025 * 12); // 792_300
    });

    it('calculates premium with nursing care for people over 40', () => {
      expect(calculateHealthInsurancePremium(5_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(23165 * 12); // 277_980
    });

    it('calculates premium with nursing care for people over 40 with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(78535 * 12); // 942_420
    });

    // Annual income 0 / 12 = 0. SMR: 58,000円
    // Employee No LTC: 2,755. Employee With LTC: 2,755 + 522 (LTC for 58k) = 3,277
    it('handles zero income correctly', () => {
      expect(calculateHealthInsurancePremium(0, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(2755 * 12); // 33_060
      expect(calculateHealthInsurancePremium(0, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toBe(3277 * 12); // 39_324
    });

    it('handles negative income correctly', () => {
      expect(() => calculateHealthInsurancePremium(-1_000_000, false, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toThrowError('Income cannot be negative.');
      expect(() => calculateHealthInsurancePremium(-1_000_000, true, ITS_KENPO_PROVIDER, DEFAULT_PROVIDER_REGION)).toThrowError('Income cannot be negative.');
    });
  });
})

  describe('calculateHealthInsurancePremium for non-employees', () => {
    it('calculates NHI premium', () => {
      expect(calculateHealthInsurancePremium(5_000_000, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(539_380)
    })

    it('calculates NHI premium with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(920_000)
    })

    it('calculates NHI premium with nursing care', () => {
      expect(calculateHealthInsurancePremium(5_000_000, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(658_805)
    })

    it('calculates NHI premium with nursing care and cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(1_090_000)
    })

    it('handles zero income correctly', () => {
      expect(calculateHealthInsurancePremium(0, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(64_100)
      expect(calculateHealthInsurancePremium(0, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(80_700)
    })

    it('handles negative income correctly', () => {
      expect(() => calculateHealthInsurancePremium(-1_000_000, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toThrowError('Income cannot be negative.')
      expect(() => calculateHealthInsurancePremium(-1_000_000, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toThrowError('Income cannot be negative.')
    })
  })

  describe('calculateHealthInsurancePremium for employees with NHI', () => {
    // Test cases for employment income workers who are on NHI
    // (e.g., small employers, part-time workers, low income thresholds)
    it('calculates NHI premium for employment income', () => {
      expect(calculateHealthInsurancePremium(5_000_000, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(539_380)
    })

    it('calculates NHI premium for employment income with nursing care', () => {
      expect(calculateHealthInsurancePremium(5_000_000, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(658_805)
    })

    it('calculates NHI premium for employment income with cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(920_000)
    })

    it('calculates NHI premium for employment income with nursing care and cap', () => {
      expect(calculateHealthInsurancePremium(20_000_000, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(1_090_000)
    })

    it('handles zero employment income correctly', () => {
      expect(calculateHealthInsurancePremium(0, false, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(64_100)
      expect(calculateHealthInsurancePremium(0, true, HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE, 'Tokyo')).toBe(80_700)
    })
  })
