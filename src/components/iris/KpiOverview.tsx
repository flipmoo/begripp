import React from 'react';
import { Card, CardContent } from '../ui/card';
import { useIris } from '../../contexts/IrisContext';

/**
 * KPI Overview Component
 *
 * Deze component toont een overzicht van de belangrijkste KPIs voor IRIS.
 */
export const KpiOverview: React.FC = () => {
  const { revenueData, correctedRevenueData, monthlyTargets, finalRevenue, selectedYear, viewMode, excludedProjects } = useIris();

  // Bereken KPIs
  const kpis = React.useMemo(() => {
    // Gebruik altijd de gecorrigeerde revenue data als die beschikbaar is
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    // Controleer of dataToUse een array is
    if (!dataToUse || !Array.isArray(dataToUse)) {
      return {
        totalRevenue: 0,
        totalHours: 0,
        averageHourlyRate: 0,
        projectCount: 0,
        clientCount: 0,
        revenueByType: {
          'Vaste Prijs': 0,
          'Nacalculatie': 0,
          'Intern': 0,
          'Contract': 0,
          'Offerte': 0,
          'Verkeerde tag': 0
        },
        revenueByTypeWithHidden: {
          'Vaste Prijs': 0,
          'Nacalculatie': 0,
          'Intern': 0,
          'Contract': 0,
          'Offerte': 0,
          'Verkeerde tag': 0
        },
        hasHiddenProjects: false,
        hiddenProjectsByType: {
          'Vaste Prijs': false,
          'Nacalculatie': false,
          'Intern': false,
          'Contract': false,
          'Offerte': false,
          'Verkeerde tag': false
        }
      };
    }

    // Bereken totale omzet en uren
    let totalRevenue = 0;
    let totalHours = 0;
    const uniqueProjects = new Set();
    const uniqueClients = new Set();

    // Initialiseer omzet per projecttype (alleen zichtbare projecten)
    const revenueByType: Record<string, number> = {
      'Vaste Prijs': 0,
      'Nacalculatie': 0,
      'Intern': 0,
      'Contract': 0,
      'Offerte': 0,
      'Verkeerde tag': 0
    };

    // Initialiseer omzet per projecttype (inclusief verborgen projecten)
    const revenueByTypeWithHidden: Record<string, number> = {
      'Vaste Prijs': 0,
      'Nacalculatie': 0,
      'Intern': 0,
      'Contract': 0,
      'Offerte': 0,
      'Verkeerde tag': 0
    };

    // Bijhouden of er verborgen projecten zijn per type
    const hiddenProjectsByType: Record<string, boolean> = {
      'Vaste Prijs': false,
      'Nacalculatie': false,
      'Intern': false,
      'Contract': false,
      'Offerte': false,
      'Verkeerde tag': false
    };

    // Bijhouden of er verborgen projecten zijn
    let hasHiddenProjects = false;

    dataToUse.forEach(item => {
      // Bepaal het projecttype
      const projectType = item.offerprojectbase_discr === 'offerte' ? 'Offerte' : (item.projectType || 'Verkeerde tag');

      // Voeg altijd toe aan revenueByTypeWithHidden (inclusief verborgen projecten)
      if (revenueByTypeWithHidden[projectType] !== undefined) {
        revenueByTypeWithHidden[projectType] += item.revenue;
      } else {
        revenueByTypeWithHidden['Verkeerde tag'] += item.revenue;
      }

      // Controleer of het project is uitgesloten
      if (excludedProjects.includes(item.projectId)) {
        // Markeer dat er verborgen projecten zijn voor dit type
        if (revenueByType[projectType] !== undefined) {
          hiddenProjectsByType[projectType] = true;
          hasHiddenProjects = true;
        }
        return; // Sla uitgesloten projecten over voor de rest van de berekeningen
      }

      // Bereken totalen voor zichtbare projecten
      totalRevenue += item.revenue;
      totalHours += item.hours;
      uniqueProjects.add(item.projectId);
      if (item.clientName) {
        uniqueClients.add(item.clientName);
      }

      // Bereken omzet per projecttype voor zichtbare projecten
      if (revenueByType[projectType] !== undefined) {
        revenueByType[projectType] += item.revenue;
      } else {
        revenueByType['Verkeerde tag'] += item.revenue;
      }
    });

    // Bereken gemiddeld uurtarief
    const averageHourlyRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      totalRevenue,
      totalHours,
      averageHourlyRate,
      projectCount: uniqueProjects.size,
      clientCount: uniqueClients.size,
      revenueByType,
      revenueByTypeWithHidden,
      hasHiddenProjects,
      hiddenProjectsByType
    };
  }, [revenueData, correctedRevenueData, excludedProjects]);

  // Bereken totale target voor het jaar
  const yearlyTarget = React.useMemo(() => {
    if (!monthlyTargets || !Array.isArray(monthlyTargets)) return 0;

    return monthlyTargets.reduce((sum, target) => {
      if (target.year === selectedYear) {
        return sum + parseFloat(target.targetAmount.toString());
      }
      return sum;
    }, 0);
  }, [monthlyTargets, selectedYear]);

  // Bereken totale definitieve omzet
  const totalDefiniteRevenue = React.useMemo(() => {
    if (!finalRevenue || !Array.isArray(finalRevenue)) return 0;

    return finalRevenue.reduce((sum, item) => {
      if (item.year === selectedYear) {
        return sum + parseFloat(item.amount.toString());
      }
      return sum;
    }, 0);
  }, [finalRevenue, selectedYear]);

  // Bereken verschil tussen target en actueel
  const difference = yearlyTarget - kpis.totalRevenue;
  const differencePercentage = yearlyTarget > 0 ? (kpis.totalRevenue / yearlyTarget) * 100 : 0;

  // Formateer getallen in Nederlands formaat
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('nl-NL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Functie om de juiste kleur te bepalen op basis van projectType
  const getTagColorClasses = (type: string) => {
    switch (type) {
      case 'Vaste Prijs':
        return "bg-blue-100 text-blue-800";
      case 'Nacalculatie':
        return "bg-green-100 text-green-800";
      case 'Intern':
        return "bg-gray-100 text-gray-800";
      case 'Contract':
        return "bg-yellow-100 text-yellow-800";
      case 'Offerte':
        return "bg-purple-100 text-purple-800";
      case 'Verkeerde tag':
        return "bg-red-100 text-red-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  return (
    <>
      {/* Alle KPIs op één rij */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Totaal Omzet {selectedYear}</div>
            <div className="text-2xl font-bold mt-1">
              € {formatNumber(kpis.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Totaal Uren</div>
            <div className="text-2xl font-bold mt-1">
              {kpis.totalHours.toFixed(1)}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Gemiddeld Uurtarief</div>
            <div className="text-2xl font-bold mt-1">
              € {formatNumber(kpis.averageHourlyRate)}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Aantal Projecten</div>
            <div className="text-2xl font-bold mt-1">
              {kpis.projectCount}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Aantal Klanten</div>
            <div className="text-2xl font-bold mt-1">
              {kpis.clientCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Omzet per projecttype */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Omzet per type project</h3>
          {kpis.hasHiddenProjects && (
            <div className="text-sm text-amber-600 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Inclusief verborgen projecten
            </div>
          )}
        </div>
        <div className="grid grid-cols-6 gap-4">
          {Object.entries(kpis.revenueByTypeWithHidden).map(([type, revenue]) => {
            // Bereken het percentage op basis van de totale omzet inclusief verborgen projecten
            const totalRevenueWithHidden = Object.values(kpis.revenueByTypeWithHidden).reduce((sum, val) => sum + val, 0);
            const percentage = totalRevenueWithHidden > 0 ? (revenue / totalRevenueWithHidden) * 100 : 0;

            return (
              <Card key={type} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTagColorClasses(type)}`}>
                      {type}
                    </span>
                    <span className="text-sm text-gray-500">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xl font-bold">
                    € {formatNumber(revenue)}
                  </div>
                  {kpis.hiddenProjectsByType[type] && (
                    <div className="text-xs text-amber-600 mt-1">
                      Inclusief verborgen projecten
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Derde rij met targets en totalen */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Target Totaal</div>
            <div className="text-2xl font-bold mt-1">€ {formatNumber(yearlyTarget)}</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Actueel Totaal</div>
            <div className="text-2xl font-bold mt-1">
              € {formatNumber(kpis.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Definitief Totaal</div>
            <div className="text-2xl font-bold mt-1">€ {formatNumber(totalDefiniteRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Verschil</div>
            <div className={`text-2xl font-bold mt-1 ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              € {formatNumber(difference)}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-500">Percentage</div>
            <div className={`text-2xl font-bold mt-1 ${differencePercentage >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
              {differencePercentage.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
