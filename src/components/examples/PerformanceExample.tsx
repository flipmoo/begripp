/**
 * PerformanceExample
 * 
 * Een voorbeeld component dat laat zien hoe je performance optimalisaties kunt toepassen.
 */
import React, { useState, useCallback, useMemo } from 'react';

// UI componenten
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// Performance utilities
import {
  useDeepMemo,
  useDebounce,
  useThrottle,
  useRenderPerformance,
  withMemo,
  withDeepMemo
} from '../../utils/performance-utils';

// Types
interface Item {
  id: number;
  name: string;
}

/**
 * Een component dat een lijst van items rendert
 */
function ItemList({ items, onItemClick }: { items: Item[], onItemClick: (item: Item) => void }) {
  // Meet de rendering performance
  useRenderPerformance('ItemList');
  
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.id}
          className="p-2 border rounded cursor-pointer hover:bg-gray-50"
          onClick={() => onItemClick(item)}
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}

/**
 * Een gememoizeerde versie van ItemList
 */
const MemoizedItemList = withMemo(ItemList);

/**
 * Een component dat een item detail rendert
 */
function ItemDetail({ item }: { item: Item | null }) {
  // Meet de rendering performance
  useRenderPerformance('ItemDetail');
  
  if (!item) {
    return <div className="p-4 bg-gray-50 rounded">Selecteer een item</div>;
  }
  
  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-medium">Item Details</h3>
      <div className="mt-2">
        <div className="font-medium">ID</div>
        <div>{item.id}</div>
      </div>
      <div className="mt-2">
        <div className="font-medium">Naam</div>
        <div>{item.name}</div>
      </div>
    </div>
  );
}

/**
 * Een gememoizeerde versie van ItemDetail met diepe vergelijking
 */
const DeepMemoizedItemDetail = withDeepMemo(ItemDetail);

/**
 * Een component dat een zoekveld rendert
 */
function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  // Meet de rendering performance
  useRenderPerformance('SearchInput');
  
  const [query, setQuery] = useState('');
  
  // Gebruik debounce om te voorkomen dat er te veel zoekopdrachten worden uitgevoerd
  const debouncedQuery = useDebounce(query, 300);
  
  // Effect om de zoekopdracht uit te voeren wanneer de gedebouncede query verandert
  React.useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);
  
  return (
    <div className="space-y-2">
      <Label htmlFor="search">Zoeken</Label>
      <Input
        id="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Zoek items..."
      />
      <div className="text-sm text-gray-500">
        Typ om te zoeken (debounced met 300ms)
      </div>
    </div>
  );
}

/**
 * PerformanceExample
 * 
 * Een voorbeeld component dat laat zien hoe je performance optimalisaties kunt toepassen.
 */
export function PerformanceExample() {
  // State
  const [count, setCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  
  // Genereer een lijst met items
  const allItems = useMemo(() => {
    console.log('Generating items...');
    return Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`
    }));
  }, []);
  
  // Filter items op basis van de zoekopdracht
  const filteredItems = useMemo(() => {
    console.log('Filtering items...');
    if (!searchQuery) return allItems;
    
    return allItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allItems, searchQuery]);
  
  // Gebruik useDeepMemo voor complexe objecten
  const complexObject = useDeepMemo({
    items: filteredItems,
    count,
    selectedItem
  });
  
  // Event handlers
  const handleIncrement = useCallback(() => {
    setCount(prevCount => prevCount + 1);
  }, []);
  
  const handleItemClick = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);
  
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);
  
  // Gebruik useThrottle voor event handlers die vaak worden aangeroepen
  const handleMouseMove = useThrottle((e: React.MouseEvent) => {
    console.log('Mouse moved:', e.clientX, e.clientY);
  }, 500);
  
  // Render helpers
  const renderBasicExample = () => (
    <div className="space-y-4">
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Normale Component (re-rendert bij elke state wijziging)</div>
        <div className="flex items-center space-x-4">
          <div>Count: {count}</div>
          <Button onClick={handleIncrement}>Increment</Button>
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Met useMemo (voorkomt onnodige berekeningen)</div>
        <div>Aantal gefilterde items: {filteredItems.length}</div>
      </div>
      
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Met useCallback (voorkomt onnodige re-renders van child componenten)</div>
        <Button onClick={handleIncrement}>Increment (memoized)</Button>
      </div>
    </div>
  );
  
  const renderAdvancedExample = () => (
    <div className="space-y-4">
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Met useDebounce (voorkomt te veel API calls)</div>
        <SearchInput onSearch={handleSearch} />
      </div>
      
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Met useThrottle (beperkt frequente events)</div>
        <div
          className="h-32 bg-gray-100 flex items-center justify-center cursor-pointer"
          onMouseMove={handleMouseMove}
        >
          Beweeg je muis hier (throttled met 500ms)
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Met useDeepMemo (diepe vergelijking voor complexe objecten)</div>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
          {JSON.stringify(complexObject, null, 2)}
        </pre>
      </div>
    </div>
  );
  
  const renderComponentExample = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Normale ItemList (re-rendert bij elke state wijziging)</div>
          <ItemList items={filteredItems.slice(0, 5)} onItemClick={handleItemClick} />
        </div>
        
        <div>
          <div className="font-medium mb-2">Gememoizeerde ItemList (voorkomt onnodige re-renders)</div>
          <MemoizedItemList items={filteredItems.slice(0, 5)} onItemClick={handleItemClick} />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Normale ItemDetail</div>
          <ItemDetail item={selectedItem} />
        </div>
        
        <div>
          <div className="font-medium mb-2">Diep Gememoizeerde ItemDetail</div>
          <DeepMemoizedItemDetail item={selectedItem} />
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <div className="font-medium mb-2">Acties</div>
        <div className="flex space-x-2">
          <Button onClick={handleIncrement}>
            Increment Count: {count}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedItem(filteredItems[Math.floor(Math.random() * filteredItems.length)])}
          >
            Selecteer Willekeurig Item
          </Button>
        </div>
      </div>
    </div>
  );
  
  // Component render
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Performance Optimalisatie Voorbeelden</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="basic">Basis Optimalisaties</TabsTrigger>
            <TabsTrigger value="advanced">Geavanceerde Optimalisaties</TabsTrigger>
            <TabsTrigger value="components">Component Optimalisaties</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic">
            {renderBasicExample()}
          </TabsContent>
          
          <TabsContent value="advanced">
            {renderAdvancedExample()}
          </TabsContent>
          
          <TabsContent value="components">
            {renderComponentExample()}
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-2">Performance Tips</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Gebruik <code>useMemo</code> voor dure berekeningen</li>
            <li>Gebruik <code>useCallback</code> voor functies die als props worden doorgegeven</li>
            <li>Gebruik <code>React.memo</code> voor componenten die vaak renderen maar weinig veranderen</li>
            <li>Gebruik <code>useDebounce</code> voor input velden om te voorkomen dat er te veel API calls worden gedaan</li>
            <li>Gebruik <code>useThrottle</code> voor event handlers die vaak worden aangeroepen (scroll, resize, mousemove)</li>
            <li>Gebruik <code>useDeepMemo</code> voor complexe objecten die diepe vergelijking nodig hebben</li>
            <li>Open de console om de rendering performance te zien</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
