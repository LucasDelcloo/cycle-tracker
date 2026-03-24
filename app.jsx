const { useState, useEffect, useRef, useMemo } = React;

// Utility for parsing DD/MM/YYYY or YYYY-MM-DD cleanly into local timezone
const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const eurMatch = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (eurMatch) {
        let day = parseInt(eurMatch[1]);
        let month = parseInt(eurMatch[2]);
        let year = parseInt(eurMatch[3]);
        if (month > 12 && day <= 12) { month = eurMatch[1]; day = eurMatch[2]; }
        return new Date(year, month - 1, day, 12, 0, 0);
    }
    const isoMatch = dateStr.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    if (isoMatch) {
        return new Date(isoMatch[1], isoMatch[2] - 1, isoMatch[3], 12, 0, 0);
    }
    return new Date(dateStr);
};

const computeCycles = (sortedEntries) => {
    if (sortedEntries.length === 0) return [];
    
    let currentCycle = [];
    const cycles = [];
    
    for (let i = 0; i < sortedEntries.length; i++) {
        const e = sortedEntries[i];
        let isNewCycle = false;

        // Force new cycle if user marks day 1
        if (e.manualCycleDay === 1) {
            isNewCycle = true;
        } else if (e.menstruating) {
            const prev = i > 0 ? sortedEntries[i - 1] : null;
            let gapDays = 0;
            if (prev) {
                const d1 = parseLocalDate(prev.date);
                const d2 = parseLocalDate(e.date);
                gapDays = Math.round((d2 - d1) / 86400000);
            }
            if (!prev || !prev.menstruating || gapDays > 5) {
                isNewCycle = true;
            }
        }
        
        if (isNewCycle && currentCycle.length > 0) {
            cycles.push(currentCycle);
            currentCycle = [];
        }
        currentCycle.push(e);
    }
    if (currentCycle.length > 0) {
        cycles.push(currentCycle);
    }
    
    cycles.forEach(cycle => {
        const firstEntry = cycle[0];
        let baseDate = parseLocalDate(firstEntry.date);
        
        if (firstEntry.manualCycleDay) {
            baseDate.setDate(baseDate.getDate() - (firstEntry.manualCycleDay - 1));
        }
        
        cycle.forEach(e => {
            const d = parseLocalDate(e.date);
            e.cycleDay = Math.round((d - baseDate) / 86400000) + 1;
        });
    });
    
    return cycles;
};

// UI Components
const DropIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
    </svg>
);

const ChevronIcon = ({ direction = 'down' }) => {
    let transform = 'rotate(0deg)';
    if (direction === 'up') transform = 'rotate(180deg)';
    if (direction === 'left') transform = 'rotate(90deg)';
    if (direction === 'right') transform = 'rotate(-90deg)';
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform, transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    );
};

// Hooks
const useCycleData = () => {
    const [entries, setEntries] = useState(() => {
        const saved = localStorage.getItem('cycle-tracker-data');
        if (saved) return JSON.parse(saved);
        return [
            { id: 1, date: '2023-10-01', temp: 36.2, menstruating: true },
            { id: 2, date: '2023-10-02', temp: 36.1, menstruating: true },
            { id: 3, date: '2023-10-03', temp: 36.3, menstruating: true },
            { id: 4, date: '2023-10-04', temp: 36.2, menstruating: false },
            { id: 5, date: '2023-10-05', temp: 36.1, menstruating: false },
            { id: 6, date: '2023-10-06', temp: 36.3, menstruating: false },
            { id: 7, date: '2023-10-07', temp: 36.2, menstruating: false },
            { id: 8, date: '2023-10-08', temp: 36.1, menstruating: false },
            { id: 9, date: '2023-10-09', temp: 36.6, menstruating: false },
            { id: 10, date: '2023-10-10', temp: 36.7, menstruating: false },
            { id: 11, date: '2023-10-11', temp: 36.8, menstruating: false },
            { id: 12, date: '2023-10-12', temp: 36.6, menstruating: false }
        ];
    });

    useEffect(() => {
        localStorage.setItem('cycle-tracker-data', JSON.stringify(entries));
    }, [entries]);

    const addEntry = (entry) => {
        setEntries(prev => {
            const filtered = prev.filter(e => e.date !== entry.date);
            return [...filtered, { ...entry, id: Date.now() }].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
        });
    };

    const deleteEntry = (id) => {
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const editEntry = (updatedEntry) => {
        setEntries(prev => {
            const newEntries = prev.map(e => e.id === updatedEntry.id ? updatedEntry : e);
            return newEntries.sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
        });
    };

    const cycles = useMemo(() => computeCycles([...entries].sort((a,b) => parseLocalDate(a.date) - parseLocalDate(b.date))), [entries]);

    return { entries, cycles, addEntry, deleteEntry, editEntry };
};

const detectOvulations = (cycle) => {
    const results = [];
    if (cycle.length < 9) return results;

    for (let i = 6; i < cycle.length - 2; i++) {
        const pre6 = cycle.slice(i - 6, i);
        const avgPre6 = pre6.reduce((sum, d) => sum + d.temp, 0) / 6;

        const p1 = cycle[i];
        const p2 = cycle[i + 1];
        const p3 = cycle[i + 2];

        if (p1.temp >= avgPre6 + 0.2 && p2.temp >= avgPre6 + 0.2 && p3.temp >= avgPre6 + 0.2) {
            const ovulationDay = cycle[i - 1].date;
            const ovDate = parseLocalDate(ovulationDay);
            const fwStart = parseLocalDate(ovulationDay);
            fwStart.setDate(ovDate.getDate() - 5);
            
            results.push({
                ovulationDate: ovulationDay,
                fertileStartDateObj: fwStart,
                ovulationDateObj: ovDate
            });
            i += 10;
        }
    }
    return results;
};

// Components
const Header = () => (
    <header className="py-6 border-b border-appleGray3 mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-appleRed inline-block"></span>
            Cycle Tracker
        </h1>
        <p className="text-gray-400 mt-1">Track your BBT and identify your fertile window.</p>
    </header>
);

const getExpectedCycleDay = (dateStr, entries, menstruating) => {
    if (menstruating) return 1;
    if (entries.length === 0) return '';
    const sorted = [...entries].sort((a,b) => parseLocalDate(a.date) - parseLocalDate(b.date));
    const cycles = computeCycles(sorted);
    const targetDate = parseLocalDate(dateStr);
    
    let bestBaseDate = null;
    for (const cycle of cycles) {
        const firstEntry = cycle[0];
        let baseDate = parseLocalDate(firstEntry.date);
        if (firstEntry.manualCycleDay) {
            baseDate.setDate(baseDate.getDate() - (firstEntry.manualCycleDay - 1));
        }
        if (baseDate <= targetDate) {
            bestBaseDate = baseDate;
        }
    }
    
    if (bestBaseDate) {
        return Math.round((targetDate - bestBaseDate) / 86400000) + 1;
    }
    return '';
};

const EntryForm = ({ entries, onAdd }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [temp, setTemp] = useState('36.5');
    const [menstruating, setMenstruating] = useState(false);
    const [manualDay, setManualDay] = useState('');
    const [notes, setNotes] = useState('');

    const expectedCycleDay = useMemo(() => getExpectedCycleDay(date, entries, menstruating), [date, entries, menstruating]);

    useEffect(() => {
        if (expectedCycleDay !== '') setManualDay(expectedCycleDay);
        else setManualDay('');
    }, [expectedCycleDay]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = { date, temp: parseFloat(temp), menstruating, notes };
        
        if (expectedCycleDay === '' && manualDay) {
            payload.manualCycleDay = parseInt(manualDay);
        } else if (manualDay !== '' && parseInt(manualDay) !== expectedCycleDay) {
             payload.manualCycleDay = parseInt(manualDay);
        }
        
        onAdd(payload);
        setMenstruating(false);
        setNotes('');
    };

    const adjustDate = (days) => {
        const d = parseLocalDate(date);
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayString = String(d.getDate()).padStart(2, '0');
        setDate(`${y}-${m}-${dayString}`);
    };

    return (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
            <h2 className="text-xl font-semibold mb-2">Log Daily Data</h2>
            
            <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-400">Date</label>
                <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => adjustDate(-1)} className="btn-danger-outline p-2 h-full flex items-center justify-center border-appleGray3 text-gray-400 hover:text-white hover:bg-appleGray3 hover:border-appleGray3" title="Previous Day">
                        <ChevronIcon direction="left" />
                    </button>
                    <input type="date" className="input-field flex-grow text-center" value={date} onChange={e => setDate(e.target.value)} required />
                    <button type="button" onClick={() => adjustDate(1)} className="btn-danger-outline p-2 h-full flex items-center justify-center border-appleGray3 text-gray-400 hover:text-white hover:bg-appleGray3 hover:border-appleGray3" title="Next Day">
                        <ChevronIcon direction="right" />
                    </button>
                </div>
            </div>
            
            <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-400">Basal Body Temp (°C)</label>
                <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => setTemp((parseFloat(temp) - 0.1).toFixed(2))} className="btn-danger-outline p-2 h-full flex items-center justify-center border-appleGray3 text-gray-400 hover:text-white hover:bg-appleGray3 hover:border-appleGray3" title="Decrease Temp">
                        <ChevronIcon direction="left" />
                    </button>
                    <input type="number" step="0.01" className="input-field flex-grow text-center" value={temp} onChange={e => setTemp(e.target.value)} required />
                    <button type="button" onClick={() => setTemp((parseFloat(temp) + 0.1).toFixed(2))} className="btn-danger-outline p-2 h-full flex items-center justify-center border-appleGray3 text-gray-400 hover:text-white hover:bg-appleGray3 hover:border-appleGray3" title="Increase Temp">
                        <ChevronIcon direction="right" />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between mt-2">
                <label className="text-sm text-gray-300">Menstruating?</label>
                <input type="checkbox" className="toggle-checkbox" checked={menstruating} onChange={e => setMenstruating(e.target.checked)} />
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm text-gray-400 flex justify-between">
                    Day of Cycle
                    <span className="text-xs text-gray-500 italic">{expectedCycleDay === '' ? "(Required)" : "(Auto)"}</span>
                </label>
                <input type="number" className="input-field text-center bg-appleGray3 border-none" 
                    value={manualDay} 
                    onChange={e => setManualDay(e.target.value)} 
                    placeholder="Day of cycle (e.g. 1)"
                    required={expectedCycleDay === ''} />
            </div>

            <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm text-gray-400">Notes / Symptoms</label>
                <textarea className="input-field bg-appleGray3 border-none resize-none text-sm p-3" rows="2" 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="Enter any symptoms or notes..." />
            </div>

            <button type="submit" className="btn-primary mt-4">Save Entry</button>
        </form>
    );
};

const HistoryList = ({ entries, onDelete, onEdit, cycleIndex, totalCycles, onPrev, onNext }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);

    const sortedDesc = [...entries].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));

    const startEdit = (entry) => {
        setEditingId(entry.id);
        setEditForm({ ...entry });
    };

    const saveEdit = () => {
        onEdit(editForm);
        setEditingId(null);
    };

    return (
        <div className="card w-full flex flex-col transition-all duration-300">
            <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold select-none">History</h2>
                    {totalCycles > 0 && (
                        <div className="flex items-center gap-2 bg-appleGray2 px-2 py-1 rounded-full border border-appleGray3" onClick={e => e.stopPropagation()}>
                            <button type="button" onClick={onPrev} disabled={cycleIndex === 0} className={`p-1 rounded ${cycleIndex === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-appleRed hover:bg-appleGray3 text-white'}`}>
                                <ChevronIcon direction="left" />
                            </button>
                            <span className="text-xs font-semibold text-gray-300 w-16 text-center">
                                Cycle {cycleIndex + 1}
                            </span>
                            <button type="button" onClick={onNext} disabled={cycleIndex >= totalCycles - 1} className={`p-1 rounded ${cycleIndex >= totalCycles - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-appleRed hover:bg-appleGray3 text-white'}`}>
                                <ChevronIcon direction="right" />
                            </button>
                        </div>
                    )}
                </div>
                <button className="text-gray-400 hover:text-white" type="button">
                    <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
                </button>
            </div>
            
            {isExpanded && (
                <div className="overflow-x-auto pb-4 pt-2 flex gap-4 w-full snap-x">
                    {sortedDesc.length === 0 ? (
                        <p className="text-gray-500 italic">No entries yet.</p>
                    ) : (
                        sortedDesc.map(e => {
                            const dateObj = parseLocalDate(e.date);
                            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                            const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                            return (
                                <div key={e.id} className="snap-start flex-shrink-0 w-48 flex flex-col bg-appleGray2 p-4 rounded-xl border border-appleGray3 relative hover:border-appleGray1 transition-colors duration-200">
                                    {editingId === e.id ? (
                                        <div className="flex flex-col gap-3 h-full justify-between">
                                            <input type="date" className="input-field py-1 px-2 text-sm" value={editForm.date} onChange={ev => setEditForm({...editForm, date: ev.target.value})} />
                                            <div className="flex gap-2 items-center">
                                                <input type="number" step="0.01" className="input-field py-1 px-2 text-sm w-full" value={editForm.temp} onChange={ev => setEditForm({...editForm, temp: parseFloat(ev.target.value)})} />
                                                <span className="text-sm text-gray-300">°C</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-300"><DropIcon /></span>
                                                <input type="checkbox" className="toggle-checkbox" style={{ transform: 'scale(0.8)' }} checked={editForm.menstruating} onChange={ev => setEditForm({...editForm, menstruating: ev.target.checked})} />
                                            </div>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <textarea className="input-field py-1 px-2 text-sm bg-appleGray3 border-none resize-none" rows="2" 
                                                    value={editForm.notes || ''} 
                                                    onChange={ev => setEditForm({...editForm, notes: ev.target.value})} 
                                                    placeholder="Notes..." />
                                            </div>
                                            <div className="flex gap-4 justify-end mt-2 border-t border-appleGray3 pt-3">
                                                <button onClick={() => setEditingId(null)} className="text-gray-400 text-sm hover:text-white transition-colors duration-200">Cancel</button>
                                                <button onClick={saveEdit} className="text-appleRed text-sm font-semibold hover:text-white transition-colors duration-200">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-center h-full">
                                            {/* Feature feature added: Day cycle badge explicitly shown */}
                                            <div className="bg-appleRed text-white text-xs font-bold px-3 py-1 rounded-full mb-3 shadow-sm">
                                                CYCLE DAY {e.cycleDay || "?"}
                                            </div>
                                            <div className="text-gray-400 text-sm uppercase tracking-wider font-semibold">{weekday}</div>
                                            <div className="text-gray-500 text-xs mb-2">{shortDate}</div>
                                            <div className="text-3xl font-bold text-appleGray300 flex items-center gap-1 justify-center my-2 text-white">
                                                {e.temp.toFixed(2)}°
                                                {e.menstruating && <div className="ml-1"><DropIcon /></div>}
                                            </div>
                                            {e.notes && (
                                                <div className="text-gray-400 text-xs italic mt-1 line-clamp-2 w-full px-2 flex-grow" title={e.notes}>
                                                    "{e.notes}"
                                                </div>
                                            )}
                                            
                                            <div className="mt-auto pt-4 flex gap-4 justify-center w-full border-t border-appleGray3">
                                                <button type="button" onClick={() => startEdit(e)} className="text-gray-400 text-sm hover:text-white transition-colors duration-200">Edit</button>
                                                <button type="button" onClick={() => onDelete(e.id)} className="text-appleRed text-sm hover:text-white transition-colors duration-200">Delete</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

const CycleChart = ({ cycle, cycleIndex, totalCycles, onPrev, onNext }) => {
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (!chartRef.current || !cycle || cycle.length === 0) return;

        if (Chart.registry && window['chartjs-plugin-annotation']) {
            Chart.register(window['chartjs-plugin-annotation']);
        }

        const ctx = chartRef.current.getContext('2d');
        const sorted = [...cycle].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
        
        const maxDay = Math.max(...sorted.map(e => e.cycleDay), 1);
        const labels = [];
        const data = [];
        const pointBackgroundColors = [];
        const pointRadii = [];
        const tooltipData = [];

        for (let day = 1; day <= maxDay; day++) {
            labels.push(`Day ${day}`);
            const entryForDay = sorted.find(e => e.cycleDay === day);
            if (entryForDay) {
                data.push(entryForDay.temp);
                pointBackgroundColors.push(entryForDay.menstruating ? '#ff3b30' : '#ffffff');
                pointRadii.push(entryForDay.menstruating ? 6 : 4);
                tooltipData.push(entryForDay);
            } else {
                data.push(null);
                pointBackgroundColors.push('#ffffff');
                pointRadii.push(0);
                tooltipData.push(null);
            }
        }
        
        const ovulations = detectOvulations(sorted);
        const annotations = {};
        
        ovulations.forEach((ov, index) => {
            const cycleBaseDate = parseLocalDate(sorted[0].date);
            if (sorted[0].manualCycleDay) {
                cycleBaseDate.setDate(cycleBaseDate.getDate() - (sorted[0].manualCycleDay - 1));
            }
            const fertDayNum = Math.round((ov.fertileStartDateObj.getTime() - cycleBaseDate.getTime()) / 86400000) + 1;
            const ovDayNum = Math.round((ov.ovulationDateObj.getTime() - cycleBaseDate.getTime()) / 86400000) + 1;
            
            const startIdx = Math.max(0, fertDayNum - 1);
            const endIdx = Math.min(labels.length - 1, ovDayNum - 1);

            if (startIdx !== -1 && endIdx !== -1) {
                annotations[`fertileWindow${index}`] = {
                    type: 'box',
                    xMin: startIdx,
                    xMax: endIdx,
                    backgroundColor: 'rgba(255, 59, 48, 0.15)',
                    borderWidth: 0,
                    drawTime: 'beforeDatasetsDraw'
                };
                
                annotations[`ovulationLine${index}`] = {
                    type: 'line',
                    xMin: endIdx,
                    xMax: endIdx,
                    borderColor: '#ff3b30',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: 'Ovulation',
                        backgroundColor: '#ff3b30',
                        color: '#fff',
                        position: 'start'
                    }
                };
            }
        });

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const validTemps = data.filter(d => d !== null);
        let yMin = 35.5;
        let yMax = 37.5;
        if (validTemps.length > 0) {
            const actualMin = Math.min(...validTemps);
            const actualMax = Math.max(...validTemps);
            yMin = Math.floor(actualMin * 10) / 10 - 0.1; 
            yMax = Math.ceil(actualMax * 10) / 10 + 0.1;
            if (yMax - yMin < 0.4) {
                yMin -= 0.1;
                yMax += 0.1;
            }
        }

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'BBT (°C)',
                    data: data,
                    spanGaps: true,
                    borderColor: '#ffffff',
                    backgroundColor: '#ffffff',
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: pointRadii,
                    pointHoverRadius: 8,
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#fff',
                scales: {
                    x: {
                        grid: { color: '#3a3a3c' },
                        ticks: { color: '#a1a1aa' }
                    },
                    y: {
                        position: 'left',
                        grid: { 
                            color: (context) => {
                                // Due to float precision, we safely check bounds
                                if (context.tick && Math.abs(context.tick.value % 0.5) < 0.01) return '#555555';
                                return '#2c2c2e';
                            },
                            lineWidth: (context) => {
                                if (context.tick && Math.abs(context.tick.value % 0.5) < 0.01) return 1.5;
                                return 1;
                            }
                        },
                        ticks: { 
                            color: '#a1a1aa',
                            stepSize: 0.1 
                        },
                        min: yMin,
                        max: yMax
                    },
                    yRight: {
                        position: 'right',
                        display: true,
                        grid: { drawOnChartArea: false },
                        ticks: { 
                            color: '#a1a1aa',
                            stepSize: 0.1 
                        },
                        min: yMin,
                        max: yMax
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const e = tooltipData[context.dataIndex];
                                if (!e) return null;
                                let label = `${e.temp}°C`;
                                if (e.menstruating) label += ' (Menstruating)';
                                label += ` - ${parseLocalDate(e.date).toLocaleDateString('en-US', { month:'short', day:'numeric'})}`;
                                return label;
                            }
                        }
                    },
                    annotation: {
                        annotations: annotations
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) chartInstance.current.destroy();
        };
    }, [cycle]);

    return (
        <div className="card w-full flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Cycle Graph</h2>
                <div className="flex items-center gap-3 bg-appleGray2 px-3 py-1 rounded-full border border-appleGray3">
                    <button type="button" onClick={onPrev} disabled={cycleIndex === 0} className={`p-1 rounded ${cycleIndex === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-appleRed hover:bg-appleGray3 text-white'}`}>
                        <ChevronIcon direction="left" />
                    </button>
                    <span className="text-sm font-semibold text-gray-300 w-20 text-center">
                        {totalCycles > 0 ? `Cycle ${cycleIndex + 1} / ${totalCycles}` : 'No Data'}
                    </span>
                    <button type="button" onClick={onNext} disabled={cycleIndex >= totalCycles - 1} className={`p-1 rounded ${cycleIndex >= totalCycles - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-appleRed hover:bg-appleGray3 text-white'}`}>
                        <ChevronIcon direction="right" />
                    </button>
                </div>
            </div>
            
            <div className="relative flex-grow w-full min-h-[18rem]">
                {!cycle || cycle.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        Add data to view chart
                    </div>
                ) : (
                    <canvas ref={chartRef}></canvas>
                )}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400 justify-center">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-white"></span> Normal Temp
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-appleRed"></span> Menstruation Temp
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 59, 48, 0.15)' }}></span> Fertile Window
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const { entries, cycles, addEntry, deleteEntry, editEntry } = useCycleData();
    const [cycleIndex, setCycleIndex] = useState(0);

    // Auto update cycle index to latest when new cycles are detected
    useEffect(() => {
        if (cycles.length > 0 && cycleIndex >= cycles.length) {
            setCycleIndex(cycles.length - 1);
        } else if (cycles.length > 0 && cycleIndex === 0) {
             setCycleIndex(cycles.length - 1);
        }
    }, [cycles.length]);

    const activeCycle = cycles[cycleIndex] || [];

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
            <Header />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Graph */}
                <div className="lg:col-span-2 flex flex-col gap-8 h-full">
                    <CycleChart 
                        cycle={activeCycle} 
                        cycleIndex={cycleIndex} 
                        totalCycles={cycles.length} 
                        onPrev={() => setCycleIndex(Math.max(0, cycleIndex - 1))}
                        onNext={() => setCycleIndex(Math.min(cycles.length - 1, cycleIndex + 1))}
                    />
                </div>
                
                {/* Right Column: Form */}
                <div className="lg:col-span-1 flex flex-col gap-8">
                    <EntryForm entries={entries} onAdd={addEntry} />
                </div>

                {/* Bottom Row: History */}
                <div className="lg:col-span-3">
                    <HistoryList 
                        entries={activeCycle} 
                        cycleIndex={cycleIndex}
                        totalCycles={cycles.length}
                        onPrev={() => setCycleIndex(Math.max(0, cycleIndex - 1))}
                        onNext={() => setCycleIndex(Math.min(cycles.length - 1, cycleIndex + 1))}
                        onDelete={deleteEntry} 
                        onEdit={editEntry} 
                    />
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

