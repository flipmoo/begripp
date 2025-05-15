# Niet-doorbelastbare uren in IRIS

Dit document beschrijft de oplossing voor het probleem met niet-doorbelastbare uren in de IRIS applicatie.

## Probleembeschrijving

In de IRIS applicatie worden uren die niet doorbelastbaar zijn (invoice_basis_id = 4) wel meegeteld in het totaal aantal uren, maar genereren ze geen omzet. Dit leidde tot verwarring omdat de totale uren hoger waren dan de uren die omzet genereren.

Specifiek voor het Digital Platform project (ID 5592) was dit een probleem omdat dit project niet-doorbelastbare uren bevat.

## Oplossing

De oplossing bestaat uit de volgende onderdelen:

1. **Directe fix in de RevenueTable component**:
   - Niet-doorbelastbare uren worden nu correct verwerkt in de berekening van de omzet
   - In de urenweergave worden alle uren getoond (inclusief niet-doorbelastbare uren)
   - In de omzetweergave worden alleen de doorbelastbare uren meegeteld

2. **Verbeterde weergave van niet-doorbelastbare uren**:
   - Een duidelijke indicator voor projecten met niet-doorbelastbare uren
   - Een tooltip die details toont over de niet-doorbelastbare uren
   - Een speciale weergave voor het Digital Platform project

3. **Nieuwe API endpoints**:
   - `/api/v1/direct-fix/non-billable-hours`: Haalt niet-doorbelastbare uren op voor een specifiek project
   - `/api/v1/direct-fix/all-non-billable-hours`: Haalt alle niet-doorbelastbare uren op voor alle projecten

4. **Nieuwe component voor niet-doorbelastbare uren**:
   - `NonBillableHoursOverview`: Toont een overzicht van alle niet-doorbelastbare uren voor alle projecten

## Technische details

### Niet-doorbelastbare uren in de database

Niet-doorbelastbare uren hebben `invoice_basis_id = 4` in de `project_lines` tabel. Deze uren worden wel meegeteld in het totaal aantal uren, maar genereren geen omzet.

```sql
SELECT 
  h.project_line_id,
  h.project_line_name,
  pl.invoice_basis_id,
  pl.invoice_basis_name,
  strftime('%m', h.date) as month,
  SUM(h.amount) as hours
FROM 
  hours h
LEFT JOIN 
  project_lines pl ON h.project_line_id = pl.id
WHERE 
  h.projectId = ? 
  AND strftime('%Y', h.date) = ?
  AND pl.invoice_basis_id = 4
GROUP BY 
  h.project_line_id, month
ORDER BY 
  month, h.project_line_id
```

### Berekening van omzet

In de RevenueTable component wordt de omzet als volgt berekend:

1. Bereken eerst de totale uren per maand (inclusief niet-doorbelastbare uren)
2. Bereken de niet-doorbelastbare uren per maand
3. Bij de weergave van omzet worden alleen de doorbelastbare uren meegeteld
4. Bij de weergave van uren worden alle uren getoond (inclusief niet-doorbelastbare uren)

```typescript
// Bereken eerst de totale uren per maand (inclusief niet-doorbelastbare uren)
const totalHoursPerMonth = Array(12).fill(0);
const nonBillableHoursPerMonth = Array(12).fill(0);

projectItems.forEach(item => {
  const monthIndex = item.month - 1;
  // Tel alle uren mee in de totale uren
  totalHoursPerMonth[monthIndex] += item.hours;

  // Tel niet-doorbelastbare uren apart
  if (item.invoiceBasisId === 4) {
    nonBillableHoursPerMonth[monthIndex] += item.hours;
  }
});
```

### Weergave in de frontend

In de frontend worden de niet-doorbelastbare uren als volgt weergegeven:

1. In de urenweergave worden alle uren getoond (inclusief niet-doorbelastbare uren)
2. In de omzetweergave worden alleen de doorbelastbare uren meegeteld
3. Een tooltip toont details over de niet-doorbelastbare uren
4. Een speciale indicator voor projecten met niet-doorbelastbare uren

```tsx
{viewMode === 'revenue' ? (
  // Omzet weergave - toon alleen de omzet van doorbelastbare uren
  value > 0 ? formatCurrency(value) : '-'
) : (
  // Uren weergave - toon alle uren (inclusief niet-doorbelastbare)
  totalHoursPerMonth[index] > 0 ? (
    <>
      {totalHoursPerMonth[index].toFixed(1)}
      {nonBillableHoursPerMonth[index] > 0 && (
        <span className="text-gray-500 text-xs ml-1">
          ({(totalHoursPerMonth[index] - nonBillableHoursPerMonth[index]).toFixed(1)} doorbelastbaar)
        </span>
      )}
    </>
  ) : '-'
)}
```

## Toekomstige verbeteringen

1. **Betere integratie met de rest van de applicatie**:
   - Integreer de niet-doorbelastbare uren in de berekening van de KPI's
   - Voeg filters toe om projecten met niet-doorbelastbare uren te tonen/verbergen

2. **Verbeterde gebruikersinterface**:
   - Voeg een toggle toe om niet-doorbelastbare uren wel/niet mee te tellen in de totalen
   - Voeg een aparte kolom toe voor niet-doorbelastbare uren in de tabel

3. **Betere documentatie**:
   - Voeg meer documentatie toe over de berekening van omzet
   - Voeg meer documentatie toe over de verschillende soorten projectregels

## Conclusie

Deze oplossing zorgt ervoor dat niet-doorbelastbare uren correct worden verwerkt in de IRIS applicatie. De gebruiker kan nu duidelijk zien welke uren doorbelastbaar zijn en welke niet, en de omzet wordt correct berekend.
