import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { toBlob } from 'html-to-image';
import { Camera, LogOut, Settings } from 'lucide-react';

const DATA_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw7kry3iRAJrmu3HY_oi27sLavISvu6tSedhcLqcIR66IpRT56991H365LrPlj88zXIAg/exec';
const AUTH_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgP4jhdt0rom8RB3r3yvc42Xg-kgB4FgJ2DQTVOFHTir1g6mVFjCAMW5BB0dpbFbSARg/exec';

interface InventoryData {
  dateString: string;
  displayDate: string;
  rubber: string;
  batches: string;
  rr: string;
  rrkg: string;
  rnStock: string;
  rrStock: string;
  ngkg: string;
  weekBatches: string;
  blendRatio: string;
  dailyValue: string;
}

const hasValidData = (d: InventoryData) => {
  return d.rnStock !== '' || d.rrStock !== '' || d.dailyValue !== '' || d.batches !== '';
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [allData, setAllData] = useState<InventoryData[]>([]);
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedCurve, setCopiedCurve] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const curveRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRubber, setSelectedRubber] = useState<string | null>(null);
  const [curveModal, setCurveModal] = useState<{isOpen: boolean, rrName: string | null}>({isOpen: false, rrName: null});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, rrName: string, data: InventoryData[], average: number}>({isOpen: false, rrName: '', data: [], average: 0});
  const [rrUsageDetailsModal, setRrUsageDetailsModal] = useState<{
    isOpen: boolean, 
    rrName: string, 
    type: 'NEXT_WEEK' | 'AVG_USAGE',
    data: InventoryData[]
  }>({isOpen: false, rrName: '', type: 'NEXT_WEEK', data: []});
  const [rrDetailsModal, setRrDetailsModal] = useState<{isOpen: boolean, rrName: string, items: InventoryData[]}>({isOpen: false, rrName: '', items: []});
  const [rrUseType, setRrUseType] = useState<'NEXT_WEEK' | 'AVG_USAGE'>('NEXT_WEEK');
  
  // Custom Settings
  const [avgDaysCount, setAvgDaysCount] = useState<number>(() => {
    const saved = localStorage.getItem('avgDaysCount');
    return saved ? parseInt(saved, 10) : 7;
  });
  const [settingsModal, setSettingsModal] = useState<boolean>(false);
  const [tempAvgDays, setTempAvgDays] = useState<number>(avgDaysCount);

  const saveSettings = () => {
    setAvgDaysCount(tempAvgDays);
    localStorage.setItem('avgDaysCount', tempAvgDays.toString());
    setSettingsModal(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetch(DATA_SCRIPT_URL)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch data');
        return response.json();
      })
      .then(rawData => {
        console.log("Raw Data:", rawData);
        if (rawData && rawData.error) {
          setError(`Server Error: ${rawData.error}`);
          setLoading(false);
          return;
        }
        if (Array.isArray(rawData) && rawData.length > 1) {
          const formattedData = rawData.slice(1).map((row: any[]) => {
            const dateObj = row[0] ? new Date(row[0]) : null;
            let dateString = '';
            let displayDate = '';
            
            if (dateObj && !isNaN(dateObj.getTime())) {
              const yyyy = dateObj.getFullYear();
              const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
              const dd = String(dateObj.getDate()).padStart(2, '0');
              dateString = `${yyyy}-${mm}-${dd}`;
              displayDate = `${dd}/${mm}/${yyyy}`;
            }
            
            return {
              dateString,
              displayDate,
              rubber: row[1] || '',
              batches: row[2] || '',
              rr: row[3] || '',
              rrkg: row[4] || '',
              rnStock: row[5] || '',
              rrStock: row[6] || '',
              ngkg: row[7] || '',
              weekBatches: row[8] || '',
              blendRatio: row[9] || '',
              dailyValue: row[10] || ''
            };
          });
          
          const validData = formattedData.filter(d => d.dateString !== '');
          setAllData(validData);

          if (validData.length > 0) {
            // Find the maximum timestamp (latest date) to set as default
            const maxTime = Math.max(...validData.map(d => new Date(d.dateString).getTime()));
            const maxDateObj = new Date(maxTime);
            const yyyy = maxDateObj.getFullYear();
            const mm = String(maxDateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(maxDateObj.getDate()).padStart(2, '0');
            setSelectedDate(`${yyyy}-${mm}-${dd}`);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [isAuthenticated]);

  // Filter data based on the selected date
  const rawDataForDate = allData.filter(item => item.dateString === selectedDate);
  
  // Group by RR to avoid duplicate rows
  const groupedDataMap = new Map<string, InventoryData>();
  rawDataForDate.forEach(item => {
    if (!item.rr) return;
    if (!groupedDataMap.has(item.rr)) {
      groupedDataMap.set(item.rr, item);
    }
  });
  const data = Array.from(groupedDataMap.values());

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      userid: { value: string };
      password: { value: string };
    };
    const userid = target.userid.value;
    const password = target.password.value;
    
    setLoginLoading(true);
    setLoginError('');

    if (userid === '180044' && password === 'MX180044') {
      setIsAuthenticated(true);
      setLoginLoading(false);
      return;
    }
    
    fetch(`${AUTH_SCRIPT_URL}?action=getUsers`)
      .then(res => res.json())
      .then((data: any) => {
        if (data && data.error) {
          setLoginError(`Server Error: ${data.error}`);
          return;
        }
        
        // Handle the format: { "users": [ { "id": "...", "password": "...", "role": "..." } ] }
        if (data && data.users && Array.isArray(data.users)) {
          const found = data.users.find((user: any) => String(user.id).trim() === userid && String(user.password).trim() === String(password));
          if (found) {
            setIsAuthenticated(true);
          } else {
            setLoginError('Invalid User ID or Password');
          }
          return;
        }
        
        // Fallback for 2D array format: [["MIXING", 123, "User"], ...]
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setLoginError('No user data found in the sheet.');
            return;
          }
          
          const found = data.find(row => String(row[0]).trim() === userid && String(row[1]).trim() === String(password));
          
          if (found) {
            setIsAuthenticated(true);
          } else {
            setLoginError('Invalid User ID or Password');
          }
        } else {
           setLoginError(`Unexpected response: ${JSON.stringify(data).substring(0, 100)}...`);
        }
      })
      .catch((err) => {
        setLoginError(`Error connecting: ${err.message}`);
      })
      .finally(() => {
        setLoginLoading(false);
      });
  };

  const handleCopyPicture = async (ref: React.RefObject<HTMLDivElement>, type: 'main' | 'curve') => {
    if (!ref.current) return;
    try {
      const scrollWidth = ref.current.scrollWidth;
      const scrollHeight = ref.current.scrollHeight;
      
      const blob = await toBlob(ref.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff', // Ensure white background
        width: scrollWidth,
        height: scrollHeight,
        style: {
          width: `${scrollWidth}px`,
          minWidth: `${scrollWidth}px`,
          maxWidth: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
          maxHeight: 'none',
          margin: '0',
          transform: 'none',
        }
      });
      
      if (blob) {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
          if (type === 'main') {
            setCopiedMain(true);
            setTimeout(() => setCopiedMain(false), 2000);
          } else {
            setCopiedCurve(true);
            setTimeout(() => setCopiedCurve(false), 2000);
          }
        }).catch(err => {
          alert('Failed to copy image to clipboard: ' + err);
        });
      }
    } catch (err) {
      console.error('Failed to capture image', err);
      alert('Failed to capture image: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-6">System Login</h2>
          {loginError && <div className="mb-4 text-red-500 text-sm text-center">{loginError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">User ID</label>
              <input 
                type="text" 
                name="userid" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input 
                type="password" 
                name="password" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
              />
            </div>
            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loginLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-xl font-bold">Loading dashboard data...</div>;
  if (error) return <div className="p-8 text-red-500 text-center text-xl font-bold">Error: {error}</div>;

  // Calculate Usable Inventory and Total Tons
  const getUsable = (item: InventoryData) => (Number(item.rnStock) || 0) + (Number(item.rrStock) || 0);
  const totalTons = (data.reduce((sum, item) => sum + getUsable(item), 0) / 1000).toFixed(1);

  // Calculate RR N.W Use (kg) by summing across all final rubbers that use this RR
  const getRRNWUse = (rrName: string) => {
    const itemsForRR = rawDataForDate.filter(d => d.rr === rrName);
    const result = itemsForRR.reduce((sum, item) => {
      const batches = Number(item.weekBatches) || 0;
      const rrkg = Number(item.rrkg) || 0;
      return sum + (batches * rrkg);
    }, 0);
    return result;
  };

  // Helper to get deduplicated past days data (excluding selected date)
  const getPastAvgDaysData = (rrName: string) => {
    if (!rrName || !selectedDate) return [];
    
    const selectedTime = new Date(selectedDate).getTime();
    
    // Get all data for this RR, sorted by date DESCENDING
    const rrData = allData
      .filter(d => d.rr === rrName && hasValidData(d))
      .sort((a, b) => new Date(b.dateString).getTime() - new Date(a.dateString).getTime());

    // Filter strictly before selectedDate
    const pastData = rrData.filter(d => new Date(d.dateString).getTime() < selectedTime);
    
    const uniquePastData: InventoryData[] = [];
    const seenDates = new Set<string>();
    
    // Iterate and collect exactly `avgDaysCount` records
    for (const item of pastData) {
      if (!seenDates.has(item.dateString)) {
        seenDates.add(item.dateString);
        uniquePastData.push({
          ...item,
          dailyValue: item.dailyValue === '' ? '0' : item.dailyValue,
          batches: item.batches === '' ? '0' : item.batches,
          weekBatches: item.weekBatches === '' ? '0' : item.weekBatches,
          rrkg: item.rrkg === '' ? '0' : item.rrkg
        });
        if (uniquePastData.length === avgDaysCount) break;
      }
    }
    
    return uniquePastData.reverse(); // Return in chronological order
  };

  // Calculate Average RR Usage for past N days (matching curve logic)
  const getRRAvgUsage = (rrName: string) => {
    const pastData = getPastAvgDaysData(rrName);
    const sum = pastData.reduce((sum, item) => {
      const batches = Number(item.batches) || 0;
      const rrkg = Number(item.rrkg) || 0;
      return sum + (batches * rrkg);
    }, 0);
    return sum / avgDaysCount;
  };

  // Get RR Use based on selected type
  const getRRUse = (rrName: string) => {
    return rrUseType === 'NEXT_WEEK' ? getRRNWUse(rrName) : getRRAvgUsage(rrName);
  };

  // Calculate N-day RN Average
  const getRNAverage = (rrName: string) => {
    const pastData = getPastAvgDaysData(rrName);
    const sum = pastData.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0);
    return Math.round(sum / avgDaysCount);
  };

  // Calculate Use Day
  const getUseDay = (item: InventoryData) => {
    const usable = getUsable(item);
    const use = Number(getRRUse(item.rr));
    const rnAvg = getRNAverage(item.rr);

    if (use < rnAvg) {
      return "Out>Use";
    } else if (use === rnAvg) {
      return "Out=Use";
    } else {
      const days = usable / (use - rnAvg);
      return Math.round(days).toString();
    }
  };


  const handleWeightDoubleClick = (rrName: string) => {
    if (!rrName || !selectedDate) return;
    
    let data: InventoryData[] = [];
    if (rrUseType === 'NEXT_WEEK') {
      data = rawDataForDate.filter(d => d.rr === rrName);
    } else {
      data = getPastAvgDaysData(rrName);
    }

    setRrUsageDetailsModal({
      isOpen: true,
      rrName,
      type: rrUseType,
      data
    });
  };

  const handleDoubleClick = (rrName: string) => {
    if (!rrName || !selectedDate) return;
    
    const pastData = getPastAvgDaysData(rrName);
    const sum = pastData.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0);
    const average = Math.round(sum / avgDaysCount);

    setDetailsModal({
      isOpen: true,
      rrName,
      data: pastData,
      average
    });
  };

  const handleRRDoubleClick = (rrName: string) => {
    if (!rrName || !selectedDate) return;
    const itemsForRR = rawDataForDate.filter(d => d.rr === rrName);
    setRrDetailsModal({ isOpen: true, rrName, items: itemsForRR });
  };

  const getRatioChangeRecord = (rrName: string) => {
    if (!rrName) return [];
    
    // Find all records for this RR
    const records = allData.filter(d => d.rr === rrName);
    // Group by rubber
    const rubbers = Array.from(new Set(records.map(d => d.rubber)));
    
    const changes: {rubber: string, rr: string, date: string, rrkg: string, timestamp: number}[] = [];
    
    rubbers.forEach(rubber => {
      // Sort oldest to newest
      const rubberRecords = records.filter(d => d.rubber === rubber).sort((a, b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());
      
      let currentRrkg: string | null = null;
      rubberRecords.forEach(record => {
        if (record.rrkg !== currentRrkg) {
          // Format date as dd/mm/yyyy
          const dateParts = record.displayDate.split('/');
          const formattedDate = dateParts.length === 3 ? `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}` : record.displayDate;
          
          changes.push({
            rubber: record.rubber,
            rr: record.rr,
            date: formattedDate,
            rrkg: record.rrkg,
            timestamp: new Date(record.dateString).getTime()
          });
          currentRrkg = record.rrkg;
        }
      });
    });
    
    // Final result newest first
    return changes.sort((a, b) => b.timestamp - a.timestamp);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans text-gray-800 overflow-x-auto relative">
      <div id="main-dashboard" ref={mainRef} className="w-full shadow-lg bg-white rounded-lg p-6 min-w-[1000px]">
        <div className="flex justify-between items-center mb-6 border-b pb-2">
          <h1 className="text-2xl font-bold text-gray-900">Daily Inventory Dashboard</h1>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => handleCopyPicture(mainRef, 'main')}
              className={`flex items-center space-x-1 py-1.5 px-3 rounded text-sm transition-colors ${copiedMain ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
            >
              <Camera size={16} />
              <span>{copiedMain ? 'Copied' : 'Copy Picture'}</span>
            </button>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 px-3 rounded text-sm transition-colors"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
        {/* Top Header Row */}
        <div className="flex border border-gray-300 rounded-md overflow-hidden mb-6 w-max bg-gray-50 shadow-sm">
          <div className="bg-[#92d050] bg-opacity-90 p-2 border-r border-gray-300 font-bold text-lg flex items-center justify-center w-24 text-gray-800">
            日期：
          </div>
          <div className="p-2 border-r border-gray-300 font-bold text-xs flex items-center justify-center w-40 bg-white">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-full text-center outline-none text-gray-600 bg-transparent text-sm"
            />
          </div>
          <div 
            className={`p-2 border-r border-gray-300 font-bold text-xs flex flex-col items-center justify-center text-center w-28 cursor-pointer transition-colors ${rrUseType === 'NEXT_WEEK' ? 'bg-yellow-300 text-gray-800' : 'hover:bg-gray-100 text-gray-600'}`}
            onClick={() => setRrUseType('NEXT_WEEK')}
          >
            <span>NEXT WEEK</span>
            <span>AVERAGE</span>
          </div>
          <div 
            className={`p-2 border-r border-gray-300 font-bold text-xs flex flex-col items-center justify-center text-center w-24 cursor-pointer transition-colors ${rrUseType === 'AVG_USAGE' ? 'bg-yellow-300 text-gray-800' : 'hover:bg-gray-100 text-gray-600'}`}
            onClick={() => setRrUseType('AVG_USAGE')}
          >
            <span>AVERAGE</span>
            <span>USAGE</span>
          </div>
          <div className="p-2 border-r border-gray-300 font-bold text-xs flex flex-col items-center justify-center text-center w-28 text-gray-600">
            <span>RR</span>
            <span>COMPLETION</span>
          </div>
          <div className="p-2 font-bold text-xs flex items-center justify-center text-center w-24 cursor-pointer bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={() => selectedRubber && setCurveModal({isOpen: true, rrName: selectedRubber})}
          >
            CURVE
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-hidden rounded-md border border-gray-300 shadow-sm">
        <table className="border-collapse w-full text-center bg-white">
          <thead>
            <tr>
              <th colSpan={2} className="border-b border-r border-gray-300 bg-[#fcd5b4] bg-opacity-70 p-2.5">
                <div className="font-semibold text-sm text-gray-800">Production Requirement</div>
                <div className="text-[10px] font-normal text-gray-600 mt-0.5">(生產需求手數)</div>
              </th>
              <th colSpan={4} className="border-b border-r border-gray-300 bg-[#92d050] bg-opacity-70 p-2.5">
                <div className="font-semibold text-sm text-gray-800">Available Inventory (kg)</div>
                <div className="text-[10px] font-normal text-gray-600 mt-0.5">
                  ( 可使用庫存種類、重量、<span className="text-[#ff00ff] font-bold mx-0.5">MAX庫存&gt;7天</span> TO MIN庫存&lt;2天 )
                </div>
              </th>
              <th rowSpan={2} className="border-b border-r border-gray-300 bg-[#fcd5b4] bg-opacity-70 p-2.5 w-28 align-middle">
                <div className="font-semibold text-xs text-gray-800 flex items-center justify-center space-x-1">
                  <span>RN AVERAGE</span>
                  <button onClick={() => setSettingsModal(true)} className="text-gray-600 hover:text-gray-900 transition-colors" title="Settings">
                    <Settings size={14} />
                  </button>
                </div>
                <div className="text-[9px] font-normal text-gray-600 mt-1">(平均RR產出量)</div>
              </th>
              <th rowSpan={2} className="border-b border-gray-300 bg-[#fcd5b4] bg-opacity-70 p-2.5 w-28 align-middle">
                <div className="font-semibold text-xs text-gray-800">USE DAY</div>
                <div className="text-[9px] font-normal text-gray-600 mt-1">(摻合需求天數)</div>
              </th>
            </tr>
            <tr>
              <th className="border-b border-r border-gray-300 bg-[#fcd5b4] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-28">RR Type</th>
              <th className="border-b border-r border-gray-300 bg-[#fcd5b4] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-36">
                <div>{rrUseType === 'NEXT_WEEK' ? 'RR N.W Use (kg)' : 'RR Avg Use (kg)'}</div>
                <div className="text-[9px] font-normal text-gray-500 mt-0.5">(RRxUOP¥-§i¶q)</div>
              </th>
              <th className="border-b border-r border-gray-300 bg-[#92d050] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-36">
                <div>Usable inventory</div>
                <div className="text-[9px] font-normal text-gray-500 mt-0.5">(可使用庫存總重)</div>
              </th>
              <th className="border-b border-r border-gray-300 bg-[#92d050] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-28">
                <div>RN Inventory</div>
                <div className="text-[9px] font-normal text-gray-500 mt-0.5">(RN 庫存)</div>
              </th>
              <th className="border-b border-r border-gray-300 bg-[#92d050] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-28">
                <div>RR Inventory</div>
                <div className="text-[9px] font-normal text-gray-500 mt-0.5">(RR 庫存)</div>
              </th>
              <th className="border-b border-r border-gray-300 bg-[#92d050] bg-opacity-40 p-2 text-xs font-semibold text-gray-700 w-28">
                <div>NG Inventory</div>
                <div className="text-[9px] font-normal text-gray-500 mt-0.5">(NG 膠料庫存)</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length > 0 ? data.map((item, index) => (
              <tr key={index} 
                className={`cursor-pointer transition-colors ${selectedRubber === item.rr ? 'bg-yellow-50' : 'hover:bg-gray-50 text-gray-700'}`}
                onClick={() => setSelectedRubber(item.rr)}
              >
                <td 
                  className="border-r border-gray-200 p-2 font-medium text-sm text-gray-900 bg-white"
                  onDoubleClick={() => handleRRDoubleClick(item.rr)}
                  title="Double click to view RR details"
                >
                  {item.rr}
                </td>
                <td 
                  className="border-r border-gray-200 p-2 font-semibold text-base text-blue-700 cursor-pointer hover:bg-blue-50 transition-colors"
                  onDoubleClick={() => handleWeightDoubleClick(item.rr)}
                  title="Double click to view usage breakdown"
                >
                  {Number(getRRUse(item.rr)).toFixed(1)}
                </td>
                <td className="border-r border-gray-200 p-2 font-semibold text-base text-emerald-700 bg-emerald-50 bg-opacity-30">{Number(getUsable(item)).toFixed(1)}</td>
                <td className="border-r border-gray-200 p-2 text-sm">{Number(item.rnStock).toFixed(1)}</td>
                <td className="border-r border-gray-200 p-2 text-sm">{Number(item.rrStock).toFixed(1)}</td>
                <td className="border-r border-gray-200 p-2 text-sm text-gray-500">{Number(item.ngkg).toFixed(1)}</td>
                <td 
                  className="border-r border-gray-200 p-2 font-semibold text-base text-indigo-600 cursor-pointer hover:bg-indigo-50 transition-colors"
                  onDoubleClick={() => handleDoubleClick(item.rr)}
                  title="Double click to view 7-day breakdown"
                >
                  {getRNAverage(item.rr).toFixed(1)}
                </td>
                <td className="p-2 font-medium text-sm">
                  <span className={`px-2 py-1 rounded inline-block ${getUseDay(item) === 'Out>Use' ? 'bg-red-100 text-red-700' : getUseDay(item) === 'Out=Use' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>
                    {getUseDay(item)}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="p-10 text-base text-gray-400">
                  No data available for the selected date.
                </td>
              </tr>
            )}
            <tr className="bg-gray-50">
              <td colSpan={2} className="p-3 font-semibold text-sm text-right pr-6 text-gray-600 border-r border-gray-200">
                Total tons
              </td>
              <td className="p-3 font-bold text-base text-emerald-800 bg-emerald-100 bg-opacity-50 border-r border-gray-200">
                {totalTons}
              </td>
              <td colSpan={5} className="p-3"></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden border border-gray-300">
            <div className="bg-gray-100 border-b border-gray-300 px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center space-x-2">
                <Settings size={18} />
                <span>Calculation Settings</span>
              </h3>
              <button onClick={() => setSettingsModal(false)} className="text-gray-500 hover:text-gray-800 font-bold text-xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Average Calculation Days (RN Generation)
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="30" 
                  value={tempAvgDays}
                  onChange={(e) => setTempAvgDays(parseInt(e.target.value) || 1)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Changes made here are stored in your browser's local storage.
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  onClick={saveSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors text-sm"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal (RN Average) */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border-2 border-black">
            <div className="bg-[#fcd5b4] border-b border-black px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-xl text-black">{avgDaysCount}-Day Average: {detailsModal.rrName}</h3>
              <button onClick={() => setDetailsModal({...detailsModal, isOpen: false})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-4">
              <table className="w-full border-collapse border border-black mb-4 text-center text-sm">
                <thead>
                  <tr className="bg-[#f2f2f2]">
                    <th className="border border-black p-1.5 font-bold">Date</th>
                    <th className="border border-black p-1.5 font-bold">Daily Value (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsModal.data.map((d, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1.5">{d.displayDate}</td>
                      <td className="border border-black p-1.5 font-bold">{d.dailyValue || '0'}</td>
                    </tr>
                  ))}
                  {/* Fill empty rows if less than avgDaysCount of data */}
                  {Array.from({ length: Math.max(0, avgDaysCount - detailsModal.data.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="text-gray-400 bg-gray-50">
                      <td className="border border-black p-1.5">--</td>
                      <td className="border border-black p-1.5 italic">0 (No Data)</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ffffcc] font-bold">
                    <td className="border border-black p-1.5 text-right">Total Sum:</td>
                    <td className="border border-black p-1.5 text-base">
                      {detailsModal.data.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0)}
                    </td>
                  </tr>
                  <tr className="bg-[#92d050] font-bold text-base">
                    <td className="border border-black p-1.5 text-right">Average (Sum ÷ {avgDaysCount}):</td>
                    <td className="border border-black p-1.5 text-lg">{detailsModal.average}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="text-sm text-gray-600 italic text-center">
                * The average is always divided by {avgDaysCount} days.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RR Usage Details Modal */}
      {rrUsageDetailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border-2 border-black">
            <div className="bg-[#fcd5b4] border-b border-black px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-xl text-black">
                {rrUsageDetailsModal.type === 'NEXT_WEEK' ? 'Next Week Usage' : `${avgDaysCount}-Day Avg Usage`}: {rrUsageDetailsModal.rrName}
              </h3>
              <button onClick={() => setRrUsageDetailsModal({...rrUsageDetailsModal, isOpen: false})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-4">
              <table className="w-full border-collapse border border-black mb-4 text-center text-sm">
                <thead>
                  <tr className="bg-[#f2f2f2]">
                    <th className="border border-black p-1.5 font-bold">Date</th>
                    <th className="border border-black p-1.5 font-bold">Batches</th>
                    <th className="border border-black p-1.5 font-bold">RRkg</th>
                    <th className="border border-black p-1.5 font-bold">Usage (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {rrUsageDetailsModal.data.map((d, i) => {
                    const batches = Number(rrUsageDetailsModal.type === 'AVG_USAGE' ? d.batches : d.weekBatches) || 0;
                    const rrkg = Number(d.rrkg) || 0;
                    return (
                      <tr key={i}>
                        <td className="border border-black p-1.5">{d.displayDate}</td>
                        <td className="border border-black p-1.5">{batches.toFixed(1)}</td>
                        <td className="border border-black p-1.5">{rrkg.toFixed(1)}</td>
                        <td className="border border-black p-1.5 font-bold">
                          {(batches * rrkg).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#92d050] font-bold text-base">
                    <td className="border border-black p-1.5 text-right">
                      {rrUsageDetailsModal.type === 'AVG_USAGE' ? 'Average:' : 'Total:'}
                    </td>
                    <td className="border border-black p-1.5 text-lg">
                      {(
                        rrUsageDetailsModal.data.reduce((sum, item) => {
                          const batches = Number(rrUsageDetailsModal.type === 'AVG_USAGE' ? item.batches : item.weekBatches) || 0;
                          const rrkg = Number(item.rrkg) || 0;
                          return sum + (batches * rrkg);
                        }, 0) / (rrUsageDetailsModal.type === 'AVG_USAGE' ? avgDaysCount : 1)
                      ).toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RR Details Modal */}
      {rrDetailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white shadow-xl max-w-2xl w-full max-h-[95vh] overflow-hidden border-2 border-black flex flex-col">
            <div className="bg-[#92d050] border-b border-black px-4 py-2 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-2xl text-black text-center flex-1">{rrDetailsModal.rrName}</h3>
              <button onClick={() => setRrDetailsModal({...rrDetailsModal, isOpen: false})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-grow">
              <table className="w-full border-collapse border border-black text-center text-sm">
                <tbody>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold w-1/3">
                      <div>Rubber Type</div>
                      <div className="text-[10px] font-normal">膠料種類</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-1.5 text-base">{item.rubber}</td>
                    ))}
                    {/* Fill empty columns if less than 2 items */}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rubber-${i}`} className="border border-black p-1.5"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold">
                      <div>摻合RR種類</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-1.5 text-base">{item.rr}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rr-${i}`} className="border border-black p-1.5"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold">
                      <div>摻合比率</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-1.5 text-base">{item.blendRatio ? `${(Number(item.blendRatio) * 100).toFixed(1)}%` : ''}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-ratio-${i}`} className="border border-black p-1.5"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold">
                      <div>摻合RR重量</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-1.5 text-base">{Number(item.rrkg).toFixed(1)}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rrkg-${i}`} className="border border-black p-1.5"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold">
                      <div>摻合手數</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-1.5 text-base">{Number(item.weekBatches).toFixed(1)}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-batches-${i}`} className="border border-black p-1.5"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-1.5 bg-[#fcd5b4] font-bold">
                      <div>摻合總重</div>
                      <div className="text-[10px] font-normal">(kg)</div>
                    </td>
                    <td colSpan={2} className="border border-black p-1.5 font-bold text-xl">
                      {rrDetailsModal.items.reduce((sum, item) => sum + ((Number(item.weekBatches) || 0) * (Number(item.rrkg) || 0)), 0).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Trend Data Placeholders (As per picture) */}
              <table className="w-full border-collapse border border-black text-center mt-0 text-sm">
                <tbody>
                  <tr className="bg-[#00b0f0] text-white font-bold text-xs">
                    <td className="border border-black p-1.5 w-1/4">平均RR摻合</td>
                    <td className="border border-black p-1.5 w-1/4">RR摻合<br/>趨勢差異</td>
                    <td className="border border-black p-1.5 w-1/4 bg-[#92d050] text-black">現行每日<br/>平均手數</td>
                    <td className="border border-black p-1.5 w-1/4 bg-[#92d050] text-black">排程<br/>手數趨勢</td>
                  </tr>
                  <tr className="font-bold text-base">
                    <td className="border border-black p-1.5"><span className="text-red-500">▼</span> 426</td>
                    <td className="border border-black p-1.5">-5.0%</td>
                    <td className="border border-black p-1.5">28.4</td>
                    <td className="border border-black p-1.5">-0.90</td>
                  </tr>
                  <tr className="bg-[#00b0f0] text-white font-bold text-xs">
                    <td className="border border-black p-1.5">平均RR產出</td>
                    <td className="border border-black p-1.5">RR產出<br/>趨勢差異</td>
                    <td className="border border-black p-1.5 bg-[#92d050] text-black">下周每日<br/>平均手數</td>
                    <td className="border border-black p-1.5 bg-[#e6b8b7] text-black">平均庫存<br/>趨勢差異</td>
                  </tr>
                  <tr className="font-bold text-base">
                    <td className="border border-black p-1.5"><span className="text-green-600">▲</span> 463</td>
                    <td className="border border-black p-1.5">1.4%</td>
                    <td className="border border-black p-1.5">38.2</td>
                    <td className="border border-black p-1.5">-22.03%</td>
                  </tr>
                </tbody>
              </table>

              {/* Ratio Change Record */}
              <table className="w-full border-collapse border border-black text-center mt-0 text-sm">
                <thead>
                  <tr>
                    <th colSpan={4} className="border border-black bg-[#92d050] p-1.5 font-bold text-base">
                      <div>Ratio Change Record</div>
                      <div className="text-xs font-normal">摻合重量調整紀錄</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getRatioChangeRecord(rrDetailsModal.rrName).slice(0, 7).map((record, i) => (
                    <tr key={i} className="text-base">
                      <td className="border border-black p-1.5">{record.rubber}</td>
                      <td className="border border-black p-1.5">{record.rr}</td>
                      <td className="border border-black p-1.5">{record.date}</td>
                      <td className="border border-black p-1.5">{Number(record.rrkg).toFixed(1)}</td>
                    </tr>
                  ))}
                  {getRatioChangeRecord(rrDetailsModal.rrName).slice(0, 7).length === 0 && (
                    <tr>
                      <td colSpan={4} className="border border-black p-3 text-gray-500">No records found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        {/* Curve Modal */}
        {curveModal.isOpen && curveModal.rrName && (() => {
          const curveData = (() => {
            const filtered = allData.filter(d => d.rr === curveModal.rrName);
            const sorted = filtered.sort((a,b) => new Date(a.dateString).getTime() - new Date(b.dateString).getTime());
            const uniqueData: InventoryData[] = [];
            const seenDates = new Set<string>();
            for (const item of sorted) {
              if (!seenDates.has(item.dateString)) {
                seenDates.add(item.dateString);
                uniqueData.push(item);
              }
            }
            return uniqueData.slice(-15);
          })();

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-auto">
              <div ref={curveRef} className="bg-white rounded-lg shadow-xl w-full min-w-[1200px] max-w-[1200px] my-auto border-2 border-black flex flex-col shrink-0">
                <div className="bg-[#fcd5b4] border-b border-black px-4 py-3 flex justify-between items-center shrink-0 rounded-t-md">
                  <h3 className="font-bold text-xl text-black">{curveModal.rrName} RR+RN Inventory and Urgent Order Usage Trend Chart</h3>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => handleCopyPicture(curveRef, 'curve')}
                      className={`flex items-center space-x-1 py-1 px-2 rounded text-sm border ${copiedCurve ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'}`}
                    >
                      <Camera size={16} />
                      <span>{copiedCurve ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button onClick={() => setCurveModal({isOpen: false, rrName: null})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                      &times;
                    </button>
                  </div>
                </div>
                <div id="curve-dashboard" className="p-4 flex flex-col">
                  <div className="h-[350px] w-full mb-4 bg-[#333333] rounded-lg p-4 border border-gray-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curveData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                        <XAxis dataKey={(d: InventoryData) => d.displayDate.split('/').slice(0, 2).join('/')} stroke="#ffffff" />
                        <YAxis stroke="#ffffff" />
                        <Tooltip contentStyle={{ backgroundColor: '#000', borderColor: '#555', color: '#fff' }} />
                        <Legend wrapperStyle={{ color: '#fff' }} />
                        <Line type="monotone" dataKey={(d: InventoryData) => Number(d.rnStock) + Number(d.rrStock)} name="Total Inventory" stroke="#ff0000" strokeWidth={3} dot={{ r: 6, fill: '#ff0000', stroke: '#fff', strokeWidth: 2 }}>
                          <LabelList dataKey={(d: InventoryData) => (Number(d.rnStock) + Number(d.rrStock)).toFixed(0)} position="top" fill="#ffffff" fontSize={12} />
                        </Line>
                        <Line type="monotone" dataKey={(d: InventoryData) => Number(d.batches) * Number(d.rrkg)} name="RR Usage" stroke="#00bfff" strokeWidth={3} dot={{ r: 6, fill: '#00bfff', stroke: '#fff', strokeWidth: 2 }}>
                          <LabelList dataKey={(d: InventoryData) => (Number(d.batches) * Number(d.rrkg)).toFixed(0)} position="top" fill="#ffffff" fontSize={12} />
                        </Line>
                        <Line type="monotone" dataKey="dailyValue" name="RN Generation" stroke="#32cd32" strokeWidth={3} dot={{ r: 6, fill: '#32cd32', stroke: '#fff', strokeWidth: 2 }}>
                          <LabelList dataKey="dailyValue" position="top" fill="#ffffff" fontSize={12} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="w-full border-collapse border border-black text-center text-sm">
                    <thead>
                      <tr className="bg-[#f2f2f2]">
                        <th className="border border-black p-2 font-bold">Date</th>
                        {curveData.map((d, i) => (
                          <th key={i} className="border border-black p-2">{d.displayDate.split('/').slice(0, 2).join('/')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black p-2 font-bold bg-red-500 text-white">Total</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2 font-bold">{(Number(d.rnStock) + Number(d.rrStock)).toFixed(0)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold">RR</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2">{Number(d.rrStock).toFixed(0)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold text-red-500">RN</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2 text-red-500">{Number(d.rnStock).toFixed(0)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold">NG</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2">{Number(d.ngkg).toFixed(0)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold bg-blue-400 text-white">RR Usage</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2 font-bold">{(Number(d.batches) * Number(d.rrkg)).toFixed(0)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border border-black p-2 font-bold bg-green-400 text-white">RN Generation</td>
                        {curveData.map((d, i) => (
                          <td key={i} className="border border-black p-2 font-bold text-red-500">{Number(d.dailyValue).toFixed(0)}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}