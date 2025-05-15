import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useIris } from '../../contexts/IrisContext';
import { formatCurrency } from '../../utils/formatters';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

/**
 * Monthly Targets Component
 *
 * Deze component toont een grafiek met maandelijkse targets vs. actuele revenue.
 */
export const MonthlyTargets: React.FC = () => {
  const { revenueData, correctedRevenueData, monthlyTargets, finalRevenue, selectedYear, viewMode, calculationMode, excludedProjects } = useIris();

  // Maandnamen
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ];

  // Bereken maandelijkse omzet uit de revenueData
  const monthlyRevenue = React.useMemo(() => {
    const monthlyTotals = Array(12).fill(0);

    // Gebruik altijd de gecorrigeerde revenue data voor beide calculationModes
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    // Gebruik de excludedProjects uit de context

    if (dataToUse && Array.isArray(dataToUse)) {
      dataToUse.forEach(item => {
        // Sla items over die zijn uitgesloten
        if (excludedProjects.includes(item.projectId)) {
          return;
        }

        const monthIndex = item.month - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyTotals[monthIndex] += item.revenue;
        }
      });
    }

    return monthlyTotals;
  }, [revenueData, correctedRevenueData, calculationMode, excludedProjects]);

  // Bereken maandelijkse definitieve omzet uit finalRevenue
  const monthlyFinalRevenue = React.useMemo(() => {
    const finalTotals = Array(12).fill(0);

    // Gebruik de excludedProjects uit de context

    if (finalRevenue && Array.isArray(finalRevenue)) {
      finalRevenue.forEach(item => {
        // Sla items over die zijn uitgesloten (als projectId beschikbaar is)
        if (item.projectId && excludedProjects.includes(item.projectId)) {
          return;
        }

        const monthIndex = item.month - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          // Zorg ervoor dat amount een number is
          const amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0;
          finalTotals[monthIndex] = amount; // Gebruik = in plaats van += omdat er maar één record per maand is
        }
      });
    }

    return finalTotals;
  }, [finalRevenue, excludedProjects]);

  // We gebruiken de monthlyTargets direct, geen aparte manualTargets nodig

  // Combineer targets, actuele revenue en definitieve omzet in één dataset voor de grafiek
  const chartData = React.useMemo(() => {
    console.log('Creating chart data with:', { monthlyTargets, finalRevenue });

    return monthNames.map((name, index) => {
      // Haal target voor deze maand op uit monthlyTargets
      let targetAmount = 0;

      if (monthlyTargets && Array.isArray(monthlyTargets)) {
        const targetForMonth = monthlyTargets.find(
          target => target.month === index + 1
        );

        if (targetForMonth) {
          targetAmount = parseFloat(targetForMonth.targetAmount.toString());
          console.log(`Target for ${name}: ${targetAmount}`);
        }
      }

      // Gebruik definitieve omzet als die beschikbaar is, anders gebruik actuele omzet
      const finalAmount = monthlyFinalRevenue[index];
      const actualAmount = monthlyRevenue[index];

      // Als er definitieve omzet is, toon die samen met actuele omzet
      // Actuele omzet blijft behouden in de grafiek
      const adjustedActualAmount = actualAmount;

      // Voor de weergave en het verschil gebruiken we:
      // - Als er definitieve omzet is (ook als het 0 is): de definitieve omzet
      // - Anders: de actuele omzet
      const hasFinal = finalRevenue && Array.isArray(finalRevenue) &&
                      finalRevenue.some(item => item.month === index + 1);
      const displayAmount = hasFinal ? finalAmount : actualAmount;
      const differenceAmount = displayAmount - targetAmount;

      return {
        name,
        target: targetAmount,
        actual: adjustedActualAmount,
        final: finalAmount,
        display: displayAmount,
        difference: differenceAmount,
        hasFinal: hasFinal
      };
    });
  }, [monthNames, monthlyRevenue, monthlyFinalRevenue]);

  // Bereken totalen
  const totals = React.useMemo(() => {
    const targetTotal = chartData.reduce((sum, item) => sum + item.target, 0);
    const actualTotal = chartData.reduce((sum, item) => sum + item.actual, 0);
    const finalTotal = chartData.reduce((sum, item) => sum + item.final, 0);

    // Voor het totaal gebruiken we:
    // - Voor maanden met definitieve omzet: de definitieve omzet
    // - Voor maanden zonder definitieve omzet: de actuele omzet
    const displayTotal = chartData.reduce((sum, item) => {
      // Als er definitieve omzet is voor deze maand, gebruik die
      // Anders gebruik de actuele omzet
      return sum + item.display;
    }, 0);

    const differenceTotal = displayTotal - targetTotal;
    const percentageTotal = targetTotal > 0 ? (displayTotal / targetTotal) * 100 : 0;

    return {
      target: targetTotal,
      actual: actualTotal,
      final: finalTotal,
      display: displayTotal,
      difference: differenceTotal,
      percentage: percentageTotal,
    };
  }, [chartData]);

  // Custom tooltip voor de grafiek
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = data.target > 0 ? (data.display / data.target) * 100 : 0;

      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">Maandelijkse Target: {formatCurrency(data.target)}</p>

          <p className="text-sm">Actueel: {formatCurrency(data.actual)}</p>
          {data.hasFinal && (
            <p className="text-sm font-semibold">Definitief: {formatCurrency(data.final)}</p>
          )}

          <p className="text-sm font-semibold">
            {data.hasFinal ? 'Gebruikt voor berekening: Definitief' : 'Gebruikt voor berekening: Actueel'}
          </p>

          <p className={`text-sm ${data.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Verschil: {formatCurrency(data.difference)}
          </p>
          <p className="text-sm">
            {percentage.toFixed(1)}% van target
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="border shadow-sm mb-6">
      <CardHeader className="pb-2">
        <CardTitle>Maandelijkse Targets vs. Actueel {selectedYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <ReferenceLine y={0} stroke="#000" />
              <Bar dataKey="target" name="Maandelijkse Target" fill="#8884d8" />
              <Bar dataKey="actual" name="Actueel" fill="#4ade80" />
              <Bar dataKey="final" name="Definitief" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-5 gap-4 text-center border-t pt-4 mt-4">
          <div>
            <div className="text-sm font-medium text-gray-500">Target Totaal</div>
            <div className="font-bold">{formatCurrency(totals.target)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Actueel Totaal</div>
            <div className="font-bold">{formatCurrency(totals.actual)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Definitief Totaal</div>
            <div className="font-bold">{formatCurrency(totals.final)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Verschil</div>
            <div className={`font-bold ${totals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totals.difference)}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Percentage</div>
            <div className={`font-bold ${totals.percentage >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
              {totals.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
