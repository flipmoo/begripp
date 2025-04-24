/**
 * ImageOptimizationExample
 * 
 * Een voorbeeld component dat laat zien hoe je afbeeldingen kunt optimaliseren.
 */
import React, { useState } from 'react';

// UI componenten
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

// Geoptimaliseerde afbeelding component
import { OptimizedImage } from '../common/OptimizedImage';

/**
 * ImageOptimizationExample
 * 
 * Een voorbeeld component dat laat zien hoe je afbeeldingen kunt optimaliseren.
 */
export function ImageOptimizationExample() {
  // State
  const [activeTab, setActiveTab] = useState('comparison');
  const [blurRadius, setBlurRadius] = useState(5);
  const [lazyLoad, setLazyLoad] = useState(true);
  const [objectFit, setObjectFit] = useState<'cover' | 'contain' | 'fill'>('cover');
  
  // Voorbeeld afbeeldingen
  const images = [
    {
      src: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538',
      alt: 'Landschap',
      placeholder: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=50&blur=10',
    },
    {
      src: 'https://images.unsplash.com/photo-1682687221248-3116ba6ab483',
      alt: 'Stad',
      placeholder: 'https://images.unsplash.com/photo-1682687221248-3116ba6ab483?w=50&blur=10',
    },
    {
      src: 'https://images.unsplash.com/photo-1682695796954-bad0d0f59ff1',
      alt: 'Natuur',
      placeholder: 'https://images.unsplash.com/photo-1682695796954-bad0d0f59ff1?w=50&blur=10',
    },
  ];
  
  // Event handlers
  const handleBlurRadiusChange = (value: number[]) => {
    setBlurRadius(value[0]);
  };
  
  const handleLazyLoadChange = (checked: boolean) => {
    setLazyLoad(checked);
  };
  
  const handleObjectFitChange = (value: string) => {
    setObjectFit(value as 'cover' | 'contain' | 'fill');
  };
  
  // Render helpers
  const renderComparisonExample = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Standaard Afbeelding</div>
          <img
            src={images[0].src}
            alt={images[0].alt}
            width="100%"
            height="300"
            style={{ objectFit: 'cover', height: 300 }}
          />
          <div className="mt-2 text-sm text-gray-500">
            Standaard img tag zonder optimalisaties
          </div>
        </div>
        
        <div>
          <div className="font-medium mb-2">Geoptimaliseerde Afbeelding</div>
          <OptimizedImage
            src={images[0].src}
            alt={images[0].alt}
            placeholder={images[0].placeholder}
            width="100%"
            height={300}
            blurRadius={blurRadius}
            lazy={lazyLoad}
            objectFit={objectFit}
          />
          <div className="mt-2 text-sm text-gray-500">
            OptimizedImage component met lazy loading en placeholder
          </div>
        </div>
      </div>
      
      <div className="p-4 border rounded space-y-4">
        <div className="font-medium">Instellingen</div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="blur-radius">Blur Radius: {blurRadius}px</Label>
            <Slider
              id="blur-radius"
              min={0}
              max={20}
              step={1}
              value={[blurRadius]}
              onValueChange={handleBlurRadiusChange}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="lazy-load"
                checked={lazyLoad}
                onCheckedChange={handleLazyLoadChange}
              />
              <Label htmlFor="lazy-load">Lazy Loading</Label>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Object Fit</Label>
          <div className="flex space-x-2">
            <Button
              variant={objectFit === 'cover' ? 'default' : 'outline'}
              onClick={() => handleObjectFitChange('cover')}
              size="sm"
            >
              Cover
            </Button>
            <Button
              variant={objectFit === 'contain' ? 'default' : 'outline'}
              onClick={() => handleObjectFitChange('contain')}
              size="sm"
            >
              Contain
            </Button>
            <Button
              variant={objectFit === 'fill' ? 'default' : 'outline'}
              onClick={() => handleObjectFitChange('fill')}
              size="sm"
            >
              Fill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderGalleryExample = () => (
    <div className="space-y-4">
      <div className="font-medium">Afbeeldingengalerij met Lazy Loading</div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, index) => {
          const image = images[index % images.length];
          return (
            <OptimizedImage
              key={index}
              src={image.src}
              alt={image.alt}
              placeholder={image.placeholder}
              width="100%"
              height={200}
              lazy={true}
              className="rounded"
            />
          );
        })}
      </div>
      <div className="text-sm text-gray-500">
        Scroll naar beneden om te zien hoe afbeeldingen lazy worden geladen
      </div>
    </div>
  );
  
  const renderResponsiveExample = () => (
    <div className="space-y-4">
      <div className="font-medium">Responsieve Afbeeldingen</div>
      <div className="space-y-4">
        <div>
          <div className="text-sm text-gray-500 mb-2">Desktop (groot)</div>
          <OptimizedImage
            src={images[1].src}
            alt={images[1].alt}
            placeholder={images[1].placeholder}
            width="100%"
            height={400}
            lazy={lazyLoad}
            className="rounded"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-2">Tablet (medium)</div>
            <OptimizedImage
              src={images[1].src}
              alt={images[1].alt}
              placeholder={images[1].placeholder}
              width="100%"
              height={300}
              lazy={lazyLoad}
              className="rounded"
            />
          </div>
          
          <div>
            <div className="text-sm text-gray-500 mb-2">Mobiel (klein)</div>
            <OptimizedImage
              src={images[1].src}
              alt={images[1].alt}
              placeholder={images[1].placeholder}
              width="100%"
              height={200}
              lazy={lazyLoad}
              className="rounded"
            />
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        Dezelfde afbeelding wordt responsief weergegeven op verschillende schermformaten
      </div>
    </div>
  );
  
  // Component render
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Afbeelding Optimalisatie Voorbeelden</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="comparison">Vergelijking</TabsTrigger>
            <TabsTrigger value="gallery">Galerij</TabsTrigger>
            <TabsTrigger value="responsive">Responsief</TabsTrigger>
          </TabsList>
          
          <TabsContent value="comparison">
            {renderComparisonExample()}
          </TabsContent>
          
          <TabsContent value="gallery">
            {renderGalleryExample()}
          </TabsContent>
          
          <TabsContent value="responsive">
            {renderResponsiveExample()}
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-2">Afbeelding Optimalisatie Tips</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Gebruik <code>lazy loading</code> om alleen afbeeldingen te laden die zichtbaar zijn</li>
            <li>Gebruik <code>placeholders</code> om een betere laadervaring te bieden</li>
            <li>Gebruik <code>responsive images</code> om de juiste afbeeldingsgrootte te laden voor verschillende schermformaten</li>
            <li>Gebruik <code>WebP</code> of <code>AVIF</code> formaten voor kleinere bestandsgroottes</li>
            <li>Comprimeer afbeeldingen zonder zichtbaar kwaliteitsverlies</li>
            <li>Gebruik <code>srcset</code> en <code>sizes</code> attributen voor responsieve afbeeldingen</li>
            <li>Gebruik <code>width</code> en <code>height</code> attributen om layout shifts te voorkomen</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
