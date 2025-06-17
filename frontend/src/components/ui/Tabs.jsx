import React, { useState } from 'react';

// Componente Tabs muy básico. shadcn/ui tiene uno mucho más completo.
export const Tabs = ({ defaultValue, children, className, onValueChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue || (React.Children.toArray(children)[0]?.props.value));

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  const tabs = React.Children.toArray(children).filter(child => child.type === TabsList || child.type === TabsContent);
  const list = tabs.find(child => child.type === TabsList);
  const contents = tabs.filter(child => child.type === TabsContent);

  return (
    <div className={className}>
      {React.cloneElement(list, { activeTab, setActiveTab: handleTabChange })}
      {contents.map(content =>
        content.props.value === activeTab ? React.cloneElement(content) : null
      )}
    </div>
  );
};

export const TabsList = ({ children, activeTab, setActiveTab, className }) => (
  <div className={`flex border-b border-border mb-4 ${className}`}>
    {React.Children.map(children, child =>
      child.type === TabsTrigger ? React.cloneElement(child, { activeTab, setActiveTab }) : child
    )}
  </div>
);

export const TabsTrigger = ({ value, children, activeTab, setActiveTab, className }) => (
  <button
    onClick={() => setActiveTab(value)}
    className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors
      ${activeTab === value
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'}
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}`}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, children, className }) => (
  <div className={className}>{children}</div>
);

// Uso:
// <Tabs defaultValue="tab1" onValueChange={(value) => console.log(value)}>
//   <TabsList>
//     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
//     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
//   </TabsList>
//   <TabsContent value="tab1">Contenido Tab 1</TabsContent>
//   <TabsContent value="tab2">Contenido Tab 2</TabsContent>
// </Tabs>
