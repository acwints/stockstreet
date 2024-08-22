import React from 'react';
import { useEffect, useState } from "react";
import { Company, ScoreItem } from "../types";
import ScoreItemComponent from "./ScoreItem.tsx";
import { getCompany } from "../api";

function AIChatHistory() {
  const [company, setCompany] = useState<Company | null>(null);
  const [scoreItems, setScoreItems] = useState<ScoreItem[]>([]);

  useEffect(() => {
    getCompany().then((data) => {
      setCompany(data);
      setScoreItems(data.scoreItems);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4 py-4 w-full max-w-screen-md mx-auto px-4 sm:px-6 md:px-8">
      <h2 className="text-2xl font-semibold mb-4">
        {company?.name} - {company?.industry}
      </h2>
      <div className="flex flex-wrap gap-2">
        {scoreItems.map((item, index) => (
          <ScoreItemComponent key={index} item={item} />
        ))}
      </div>
      
      {/* New div for company description */}
      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Company Description</h3>
        <p>{company?.description}</p>
      </div>
    </div>
  );
}

export default AIChatHistory;