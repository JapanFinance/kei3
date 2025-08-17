import { useState, useEffect, Suspense, lazy } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ThemeToggle from './components/ThemeToggle'
import { TakeHomeInputForm } from './components/TakeHomeCalculator/InputForm'
import type { TakeHomeInputs, TakeHomeResults } from './types/tax'
import { calculateTaxes } from './utils/taxCalculations'
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, DEFAULT_PROVIDER } from './types/healthInsurance'
import { NATIONAL_HEALTH_INSURANCE_REGIONS } from './data/nationalHealthInsurance/nhiParamsData'
import { PROVIDER_DEFINITIONS } from './data/employeesHealthInsurance/providerRateData'

// Lazy load components that aren't immediately needed
const TakeHomeResultsDisplay = lazy(() => import('./components/TakeHomeCalculator/TakeHomeResults'))
const TakeHomeChart = lazy(() => import('./components/TakeHomeCalculator/TakeHomeChart'))

interface AppProps {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
}

function App({ mode, toggleColorMode }: AppProps) {
  // Default values for the form
  const defaultInputs: TakeHomeInputs = {
    annualIncome: 5_000_000, // 5 million yen
    isEmploymentIncome: true,
    isSubjectToLongTermCarePremium: false,
    region: "Tokyo",
    showDetailedInput: false,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    numberOfDependents: 0,
    dcPlanContributions: 0
  }

  // State for form inputs
  const [inputs, setInputs] = useState<TakeHomeInputs>(defaultInputs)

  // State for calculation results
  const [results, setResults] = useState<TakeHomeResults | null>(null)

  // Debounce the tax calculation to prevent excessive updates from rapid slider changes
  useEffect(() => {
    const calculateAndSetResults = () => {
      const takeHomePayResults = calculateTaxes(inputs);
      setResults(takeHomePayResults);
    };

    const handler = setTimeout(() => {
      calculateAndSetResults();
    }, 50);

    // Cleanup function: clear the timeout if the effect re-runs before the timeout completes
    return () => {
      clearTimeout(handler);
    };
  }, [inputs]); // Depend on the entire inputs object

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const isCheckbox = type === 'checkbox';
    const isNumber = type === 'number' || type === 'range';

    setInputs(prev => {
      let processedInputValue: string | number | boolean;
      
      if (isCheckbox) {
        processedInputValue = target.checked;
      } else if (isNumber) {
        processedInputValue = parseFloat(value as string) || 0;
      } else {
        // For select and other text-based inputs
        processedInputValue = value;
      }

      const newInputs = {
        ...prev,
        [name]: processedInputValue
      };

      // Cascading updates for health insurance provider and region
      if (name === 'isEmploymentIncome') {
        const isNowEmploymentIncome = processedInputValue as boolean;
        if (isNowEmploymentIncome) {
          newInputs.healthInsuranceProvider = 'KyokaiKenpo';
          const providerDefinition = PROVIDER_DEFINITIONS['KyokaiKenpo'];
          const providerRegions = providerDefinition ? Object.keys(providerDefinition.regions) : [];
          // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
          newInputs.region = providerRegions.includes('Tokyo') ? 'Tokyo' : 
                                 (providerRegions.length > 0 ? providerRegions[0]! : DEFAULT_PROVIDER_REGION);
        } else {
          newInputs.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
          // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
          newInputs.region = NATIONAL_HEALTH_INSURANCE_REGIONS.includes('Tokyo') ? 'Tokyo' : 
                                 (NATIONAL_HEALTH_INSURANCE_REGIONS.length > 0 ? NATIONAL_HEALTH_INSURANCE_REGIONS[0]! : DEFAULT_PROVIDER_REGION);
        }
      } else if (name === 'healthInsuranceProvider') {
        newInputs.healthInsuranceProvider = processedInputValue as string;
        if (processedInputValue === NATIONAL_HEALTH_INSURANCE_ID) {
          // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
          newInputs.region = NATIONAL_HEALTH_INSURANCE_REGIONS.includes('Tokyo') ? 'Tokyo' : 
                                 (NATIONAL_HEALTH_INSURANCE_REGIONS.length > 0 ? NATIONAL_HEALTH_INSURANCE_REGIONS[0]! : DEFAULT_PROVIDER_REGION);
        } else {
          // For employee providers (Kyokai Kenpo, ITS Kenpo, etc.)
          const providerDefinition = PROVIDER_DEFINITIONS[processedInputValue as string];
          if (providerDefinition) {
            const providerRegions = Object.keys(providerDefinition.regions);
            // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
            newInputs.region = providerRegions.includes('Tokyo') ? 'Tokyo' : 
                                   (providerRegions.length > 0 ? providerRegions[0]! : DEFAULT_PROVIDER_REGION);
          } else {
            newInputs.region = DEFAULT_PROVIDER_REGION;
            console.warn(`Data for ID ${processedInputValue} not found in Employees Health Insurance Provider data. Defaulting region.`);
          }
        }
      }
      return newInputs;
    });
  }

  return (
    <Box sx={{
      maxWidth: 1536, // max-w-6xl equivalent
      mx: 'auto',
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 4, sm: 6, md: 8 },
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      overflowX: 'hidden',
    }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 4, sm: 6, md: 8 },
        flexDirection: 'row',
        gap: { xs: 1, sm: 2 },
        '& h1': {
          fontSize: { xs: '1.75rem', sm: '2rem' },
          lineHeight: 1.2
        }
      }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 'bold',
            textAlign: { xs: 'center', sm: 'left' },
            flex: 1,
            maxWidth: { xs: '80vw', sm: 'none' },
          }}
        >
          Japan Take-Home Pay Calculator
        </Typography>
        <Box sx={{ flexShrink: 0, ml: { xs: 1, sm: 2 } }}>
          <ThemeToggle mode={mode} toggleColorMode={toggleColorMode} />
        </Box>
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: { xs: 3, md: 4 },
        width: '100%',
        '& > *': {
          minWidth: 0, // Prevent overflow issues
        }
      }}>
        <TakeHomeInputForm inputs={inputs} onInputChange={handleInputChange} />
        {results && (
          <Suspense fallback={
            <Box sx={{
              height: 256,
              borderRadius: 1,
              bgcolor: 'action.hover',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }} />
          }>
            <TakeHomeResultsDisplay 
              results={results}
              inputs={inputs}
            />
          </Suspense>
        )}
      </Box>

      <Suspense fallback={
        <Box sx={{
          height: 384,
          mt: 4,
          borderRadius: 1,
          bgcolor: 'action.hover',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
      }>
        <TakeHomeChart 
          currentIncome={inputs.annualIncome}
          isEmploymentIncome={inputs.isEmploymentIncome}
          isSubjectToLongTermCarePremium={inputs.isSubjectToLongTermCarePremium}
          healthInsuranceProvider={inputs.healthInsuranceProvider}
          region={inputs.region}
          dcPlanContributions={inputs.dcPlanContributions}
        />
      </Suspense>

      <Box sx={{
        mt: 10,
        mb: 6,
        textAlign: 'center',
        color: 'text.secondary'
      }}>
        <p>This calculator offers no guarantee of accuracy or completeness. Not all situations are covered.</p>
        <p className="mt-1">Consult with a tax professional for specific tax advice.</p>
      </Box>
    </Box>
  )
}

export default App
