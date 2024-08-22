import React from 'react';
import { ScoreItem as ScoreItemType } from '../types';

const ScoreItemComponent: React.FC<{ item: ScoreItemType }> = ({ item }) => (
  <div className="score-item">
    <h3>{item.name}</h3>
    <p>{item.value}</p>
  </div>
);

export default ScoreItemComponent;