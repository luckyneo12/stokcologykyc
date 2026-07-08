import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

const COLORS = ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6'];

const StatCard = ({ label, value, color }) => (
  <div style={{
    background: "var(--bg-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: 24,
    padding: "24px 28px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.02)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden"
  }}>
    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
      {label}
    </div>
    <div style={{ fontSize: "2.5rem", fontWeight: 900, color, letterSpacing: "-1px" }}>
      {value}
    </div>
  </div>
);

export default function GlobeOverview({ kpis }) {
  if (!kpis) return <div style={{ padding: 40, color: "var(--text-muted)", fontWeight: 600 }}>Loading analytics...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.5px", margin: 0, color: "var(--text-primary)" }}>
            Globe Analytics
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontWeight: 600 }}>
            Real-time insights and activity overview
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24, marginBottom: 40 }}>
        <StatCard label="Total Pending" value={kpis.statusDistribution?.find(s => s.name === "Pending")?.value || 0} color="#3b82f6" />
        <StatCard label="Approved (All Time)" value={kpis.approvedByGlobe} color="#10b981" />
        <StatCard label="Rejected (All Time)" value={kpis.rejectedByGlobe} color="#ef4444" />
        <StatCard label="Avg TAT (Hrs)" value={kpis.avgTatHours || "0.0"} color="#f59e0b" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginBottom: 40 }}>
        {/* Activity Chart */}
        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 24px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>Globe Review Activity (Last 7 Days)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={kpis.activityChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorApprove" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReject" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: 'var(--bg-primary)' }}
                  itemStyle={{ fontWeight: 700 }}
                  labelStyle={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}
                />
                <Area type="monotone" dataKey="approvals" name="Approvals" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorApprove)" />
                <Area type="monotone" dataKey="rejections" name="Rejections" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorReject)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 24px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>Status Distribution</h3>
          <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={kpis.statusDistribution}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {kpis.statusDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: 'var(--bg-primary)' }}
                  itemStyle={{ fontWeight: 700, color: 'var(--text-primary)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
        {/* Pending Aging Report */}
        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 24px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>Pending Aging Report</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={kpis.agingChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: 'var(--bg-primary)' }}
                  itemStyle={{ fontWeight: 700, color: '#3b82f6' }}
                  labelStyle={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rejection Reasons */}
        <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: 24, border: "1px solid var(--border-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 24px", fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>Top Rejection Reasons</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={kpis.reasonsChart} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} width={120} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(239, 68, 68, 0.05)' }}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: 'var(--bg-primary)' }}
                  itemStyle={{ fontWeight: 700, color: '#ef4444' }}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
