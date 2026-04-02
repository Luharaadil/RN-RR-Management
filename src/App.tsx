import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

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

export default function App() {
  const [allData, setAllData] = useState<InventoryData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRubber, setSelectedRubber] = useState<string | null>(null);
  const [curveModal, setCurveModal] = useState<{isOpen: boolean, rrName: string | null}>({isOpen: false, rrName: null});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, rrName: string, data: InventoryData[], average: number}>({isOpen: false, rrName: '', data: [], average: 0});
  const [rrDetailsModal, setRrDetailsModal] = useState<{isOpen: boolean, rrName: string, items: InventoryData[]}>({isOpen: false, rrName: '', items: []});

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbw7kry3iRAJrmu3HY_oi27sLavISvu6tSedhcLqcIR66IpRT56991H365LrPlj88zXIAg/exec')
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch data');
        return response.json();
      })
      .then(rawData => {
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
  }, []);

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
    return Number.isInteger(result) ? result : result.toFixed(1);
  };

  // Helper to get deduplicated past 7 days data (excluding selected date)
  const getPast7DaysData = (rrName: string) => {
    if (!rrName || !selectedDate) return [];
    
    const selectedTime = new Date(selectedDate).getTime();
    const endTime = selectedTime - (24 * 60 * 60 * 1000); // 1 day before selected date
    const startTime = selectedTime - (7 * 24 * 60 * 60 * 1000); // 7 days before selected date
    
    const rawFiltered = allData.filter(d => {
      if (d.rr !== rrName) return false;
      const dTime = new Date(d.dateString).getTime();
      return dTime >= startTime && dTime <= endTime;
    });
    
    // Sort newest first
    const sorted = rawFiltered.sort((a, b) => new Date(b.dateString).getTime() - new Date(a.dateString).getTime());
    
    // Deduplicate by date (if same day appears 2 times, consider it only once)
    const uniqueData: InventoryData[] = [];
    const seenDates = new Set<string>();
    
    for (const item of sorted) {
      if (!seenDates.has(item.dateString)) {
        seenDates.add(item.dateString);
        uniqueData.push(item);
      }
    }
    
    return uniqueData;
  };

  // Calculate 7-day RN Average
  const getRNAverage = (rrName: string) => {
    const past7DaysData = getPast7DaysData(rrName);
    const sum = past7DaysData.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0);
    return Math.round(sum / 7);
  };

  // Calculate Use Day
  const getUseDay = (item: InventoryData) => {
    const usable = getUsable(item);
    const nwUse = Number(getRRNWUse(item.rr));
    const rnAvg = getRNAverage(item.rr);

    if (nwUse < rnAvg) {
      return "Out>Use";
    } else if (nwUse === rnAvg) {
      return "Out=Use";
    } else {
      const days = usable / (nwUse - rnAvg);
      return Math.round(days).toString();
    }
  };

  const handleDoubleClick = (rrName: string) => {
    if (!rrName || !selectedDate) return;
    
    const past7DaysData = getPast7DaysData(rrName);
    const sum = past7DaysData.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0);
    const average = Math.round(sum / 7);

    setDetailsModal({
      isOpen: true,
      rrName,
      data: past7DaysData,
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
    
    const changes: {rubber: string, rr: string, date: string, rrkg: string}[] = [];
    
    rubbers.forEach(rubber => {
      const rubberRecords = records.filter(d => d.rubber === rubber).sort((a, b) => new Date(b.dateString).getTime() - new Date(a.dateString).getTime());
      
      let currentRrkg: string | null = null;
      rubberRecords.forEach(record => {
        if (record.rrkg !== currentRrkg) {
          // Format date as dd-mm-yyyy
          const dateParts = record.displayDate.split('/');
          const formattedDate = dateParts.length === 3 ? `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}` : record.displayDate;
          
          changes.push({
            rubber: record.rubber,
            rr: record.rr,
            date: formattedDate,
            rrkg: record.rrkg
          });
          currentRrkg = record.rrkg;
        }
      });
    });
    
    return changes.sort((a, b) => {
       const dateA = a.date.split('-').reverse().join('-');
       const dateB = b.date.split('-').reverse().join('-');
       return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  };

  return (
    <div className="p-4 bg-white min-h-screen font-sans text-black overflow-x-auto relative">
      <div className="min-w-[1000px]">
        {/* Top Header Row */}
        <div className="flex border border-black mb-2 w-max bg-[#f2f2f2]">
          <div className="bg-[#92d050] p-4 border-r border-black font-bold text-2xl flex items-center justify-center w-32">
            日期：
          </div>
          <div className="p-4 border-r border-black font-bold text-3xl flex items-center justify-center w-56 bg-white">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-full text-center outline-none"
            />
          </div>
          <div className="p-2 border-r border-black font-bold text-sm flex flex-col items-center justify-center text-center w-32">
            <span>NEXT WEEK</span>
            <span>AVERAGE</span>
          </div>
          <div className="p-2 border-r border-black font-bold text-sm flex flex-col items-center justify-center text-center w-28">
            <span>AVERAGE</span>
            <span>USAGE</span>
          </div>
          <div className="p-2 border-r border-black font-bold text-sm flex items-center justify-center text-center w-32">
            CHECK RR
          </div>
          <div className="p-2 border-r border-black font-bold text-sm flex flex-col items-center justify-center text-center w-36">
            <span>RR</span>
            <span>COMPLETION</span>
          </div>
          <div className="p-2 font-bold text-sm flex items-center justify-center text-center w-32 cursor-pointer bg-blue-500 text-white"
            onClick={() => selectedRubber && setCurveModal({isOpen: true, rrName: selectedRubber})}
          >
            CURVE
          </div>
        </div>

        {/* Main Table */}
        <table className="border-collapse border border-black w-full text-center bg-white">
          <thead>
            <tr>
              <th colSpan={2} className="border border-black bg-[#fcd5b4] p-2">
                <div className="font-bold text-lg">Production Requirement</div>
                <div className="text-sm font-normal">(生產需求手數)</div>
              </th>
              <th colSpan={4} className="border border-black bg-[#92d050] p-2">
                <div className="font-bold text-lg">Available Inventory (kg)</div>
                <div className="text-sm font-normal">
                  ( 可使用庫存種類、重量、<span className="text-[#ff00ff] font-bold">MAX庫存&gt;7天</span> TO MIN庫存&lt;2天 )
                </div>
              </th>
              <th rowSpan={2} className="border border-black bg-[#fcd5b4] p-2 w-32">
                <div className="font-bold text-sm">RN AVERAGE</div>
                <div className="text-xs font-normal">(平均RR產出量)</div>
              </th>
              <th rowSpan={2} className="border border-black bg-[#fcd5b4] p-2 w-32">
                <div className="font-bold text-sm">USE DAY</div>
                <div className="text-xs font-normal">(摻合需求天數)</div>
              </th>
            </tr>
            <tr>
              <th className="border border-black bg-[#fcd5b4] p-2 text-sm font-bold w-32">RR Type</th>
              <th className="border border-black bg-[#fcd5b4] p-2 text-sm font-bold w-40">
                <div>RR N.W Use (kg)</div>
                <div className="text-xs font-normal">(RRxUOP¥-§i¶q)</div>
              </th>
              <th className="border border-black bg-[#92d050] p-2 text-sm font-bold w-40">
                <div>Usable inventory</div>
                <div className="text-xs font-normal">(可使用庫存總重)</div>
              </th>
              <th className="border border-black bg-[#92d050] p-2 text-sm font-bold w-32">
                <div>RN Inventory</div>
                <div className="text-xs font-normal">(RN 庫存)</div>
              </th>
              <th className="border border-black bg-[#92d050] p-2 text-sm font-bold w-32">
                <div>RR Inventory</div>
                <div className="text-xs font-normal">(RR 庫存)</div>
              </th>
              <th className="border border-black bg-[#92d050] p-2 text-sm font-bold w-32">
                <div>NG Inventory</div>
                <div className="text-xs font-normal">(NG 膠料庫存)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((item, index) => (
              <tr key={index} 
                className={`cursor-pointer ${selectedRubber === item.rr ? 'bg-yellow-200' : 'hover:bg-gray-100'}`}
                onClick={() => setSelectedRubber(item.rr)}
              >
                <td 
                  className="border border-black p-3 font-bold text-xl"
                  onDoubleClick={() => handleRRDoubleClick(item.rr)}
                  title="Double click to view RR details"
                >
                  {item.rr}
                </td>
                <td className="border border-black p-3 font-bold text-2xl">{Number(getRRNWUse(item.rr)).toFixed(1)}</td>
                <td className="border border-black p-3 font-bold text-2xl bg-[#ffffcc]">{Number(getUsable(item)).toFixed(1)}</td>
                <td className="border border-black p-3 text-xl">{Number(item.rnStock).toFixed(1)}</td>
                <td className="border border-black p-3 text-xl">{Number(item.rrStock).toFixed(1)}</td>
                <td className="border border-black p-3 text-xl">{Number(item.ngkg).toFixed(1)}</td>
                <td 
                  className="border border-black p-3 font-bold text-2xl cursor-pointer hover:bg-gray-200 transition-colors"
                  onDoubleClick={() => handleDoubleClick(item.rr)}
                  title="Double click to view 7-day breakdown"
                >
                  {getRNAverage(item.rr).toFixed(1)}
                </td>
                <td className="border border-black p-3 font-bold text-2xl">{getUseDay(item)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="border border-black p-8 text-xl text-gray-500">
                  No data available for the selected date.
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={2} className="border border-black p-3 font-bold text-2xl text-right pr-6">
                Total tons
              </td>
              <td className="border border-black p-3 font-bold text-2xl bg-[#ffffcc]">
                {totalTons}
              </td>
              <td colSpan={4} className="border border-black p-3"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border-2 border-black">
            <div className="bg-[#fcd5b4] border-b border-black px-4 py-3 flex justify-between items-center">
              <h3 className="font-bold text-xl text-black">7-Day Average: {detailsModal.rrName}</h3>
              <button onClick={() => setDetailsModal({...detailsModal, isOpen: false})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                &times;
              </button>
            </div>
            <div className="p-4">
              <table className="w-full border-collapse border border-black mb-4 text-center">
                <thead>
                  <tr className="bg-[#f2f2f2]">
                    <th className="border border-black p-2 font-bold">Date</th>
                    <th className="border border-black p-2 font-bold">Daily Value (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsModal.data.map((d, i) => (
                    <tr key={i}>
                      <td className="border border-black p-2">{d.displayDate}</td>
                      <td className="border border-black p-2 font-bold">{d.dailyValue || '0'}</td>
                    </tr>
                  ))}
                  {/* Fill empty rows if less than 7 days of data */}
                  {Array.from({ length: Math.max(0, 7 - detailsModal.data.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="text-gray-400 bg-gray-50">
                      <td className="border border-black p-2">--</td>
                      <td className="border border-black p-2 italic">0 (No Data)</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ffffcc] font-bold">
                    <td className="border border-black p-2 text-right">Total Sum:</td>
                    <td className="border border-black p-2 text-xl">
                      {detailsModal.data.reduce((acc, curr) => acc + (Number(curr.dailyValue) || 0), 0)}
                    </td>
                  </tr>
                  <tr className="bg-[#92d050] font-bold text-lg">
                    <td className="border border-black p-2 text-right">Average (Sum ÷ 7):</td>
                    <td className="border border-black p-2 text-2xl">{detailsModal.average}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="text-sm text-gray-600 italic text-center">
                * The average is always divided by 7 days.
              </div>
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
              <table className="w-full border-collapse border border-black text-center">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold w-1/3">
                      <div>Rubber Type</div>
                      <div className="text-xs font-normal">膠料種類</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-2 text-xl">{item.rubber}</td>
                    ))}
                    {/* Fill empty columns if less than 2 items */}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rubber-${i}`} className="border border-black p-2"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold">
                      <div>摻合RR種類</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-2 text-xl">{item.rr}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rr-${i}`} className="border border-black p-2"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold">
                      <div>摻合比率</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-2 text-xl">{item.blendRatio ? `${(Number(item.blendRatio) * 100).toFixed(1)}%` : ''}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-ratio-${i}`} className="border border-black p-2"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold">
                      <div>摻合RR重量</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-2 text-xl">{Number(item.rrkg).toFixed(1)}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-rrkg-${i}`} className="border border-black p-2"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold">
                      <div>摻合手數</div>
                    </td>
                    {rrDetailsModal.items.map((item, i) => (
                      <td key={i} className="border border-black p-2 text-xl">{Number(item.weekBatches).toFixed(1)}</td>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - rrDetailsModal.items.length) }).map((_, i) => (
                      <td key={`empty-batches-${i}`} className="border border-black p-2"></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-black p-2 bg-[#fcd5b4] font-bold">
                      <div>摻合總重</div>
                      <div className="text-xs font-normal">(kg)</div>
                    </td>
                    <td colSpan={2} className="border border-black p-2 font-bold text-3xl">
                      {rrDetailsModal.items.reduce((sum, item) => sum + ((Number(item.weekBatches) || 0) * (Number(item.rrkg) || 0)), 0).toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Trend Data Placeholders (As per picture) */}
              <table className="w-full border-collapse border border-black text-center mt-0">
                <tbody>
                  <tr className="bg-[#00b0f0] text-white font-bold text-sm">
                    <td className="border border-black p-2 w-1/4">平均RR摻合</td>
                    <td className="border border-black p-2 w-1/4">RR摻合<br/>趨勢差異</td>
                    <td className="border border-black p-2 w-1/4 bg-[#92d050] text-black">現行每日<br/>平均手數</td>
                    <td className="border border-black p-2 w-1/4 bg-[#92d050] text-black">排程<br/>手數趨勢</td>
                  </tr>
                  <tr className="font-bold text-xl">
                    <td className="border border-black p-2"><span className="text-red-500">▼</span> 426</td>
                    <td className="border border-black p-2">-5.0%</td>
                    <td className="border border-black p-2">28.4</td>
                    <td className="border border-black p-2">-0.90</td>
                  </tr>
                  <tr className="bg-[#00b0f0] text-white font-bold text-sm">
                    <td className="border border-black p-2">平均RR產出</td>
                    <td className="border border-black p-2">RR產出<br/>趨勢差異</td>
                    <td className="border border-black p-2 bg-[#92d050] text-black">下周每日<br/>平均手數</td>
                    <td className="border border-black p-2 bg-[#e6b8b7] text-black">平均庫存<br/>趨勢差異</td>
                  </tr>
                  <tr className="font-bold text-xl">
                    <td className="border border-black p-2"><span className="text-green-600">▲</span> 463</td>
                    <td className="border border-black p-2">1.4%</td>
                    <td className="border border-black p-2">38.2</td>
                    <td className="border border-black p-2">-22.03%</td>
                  </tr>
                </tbody>
              </table>

              {/* Ratio Change Record */}
              <table className="w-full border-collapse border border-black text-center mt-0">
                <thead>
                  <tr>
                    <th colSpan={4} className="border border-black bg-[#92d050] p-2 font-bold text-lg">
                      <div>Ratio Change Record</div>
                      <div className="text-sm font-normal">摻合重量調整紀錄</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getRatioChangeRecord(rrDetailsModal.rrName).slice(0, 7).map((record, i) => (
                    <tr key={i} className="text-lg">
                      <td className="border border-black p-2">{record.rubber}</td>
                      <td className="border border-black p-2">{record.rr}</td>
                      <td className="border border-black p-2">{record.date}</td>
                      <td className="border border-black p-2">{Number(record.rrkg).toFixed(1)}</td>
                    </tr>
                  ))}
                  {getRatioChangeRecord(rrDetailsModal.rrName).slice(0, 7).length === 0 && (
                    <tr>
                      <td colSpan={4} className="border border-black p-4 text-gray-500">No records found</td>
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border-2 border-black flex flex-col">
                <div className="bg-[#fcd5b4] border-b border-black px-4 py-3 flex justify-between items-center shrink-0">
                  <h3 className="font-bold text-xl text-black">{curveModal.rrName} RR+RN Inventory and Urgent Order Usage Trend Chart</h3>
                  <button onClick={() => setCurveModal({isOpen: false, rrName: null})} className="text-black hover:text-gray-600 font-bold text-2xl leading-none">
                    &times;
                  </button>
                </div>
                <div className="p-4 flex-grow overflow-y-auto">
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