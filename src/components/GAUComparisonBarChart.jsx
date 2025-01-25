import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import Select from 'react-select';
import { ClipLoader } from 'react-spinners';

const GAUComparisonChart = ({ rawData, showLPJ = false, onClose }) => {
    const [viewType, setViewType] = useState('monthly');
    const [chartData, setChartData] = useState(null);
    const [selectedYears, setSelectedYears] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [legendItems, setLegendItems] = useState([]);

    useEffect(() => {        
        if (onClose) {
            document.body.style.overflow = 'hidden';
                        
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [onClose]);

    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    useEffect(() => {
        if (rawData && rawData.length) {
            setIsLoading(true);
            const years = [...new Set(rawData
                .filter(item => item.kategori === "GA/Umum")
                .map(item => new Date(item.tanggalPengajuan).getFullYear())
            )].sort((a, b) => b - a);

            const yearOptions = years.map(year => ({
                value: year.toString(),
                label: year.toString()
            }));

            setAvailableYears(yearOptions);
            if (yearOptions.length >= 2) {
                setSelectedYears([yearOptions[0], yearOptions[1]]);
            } else if (yearOptions.length === 1) {
                setSelectedYears([yearOptions[0]]);
            }
            setIsLoading(false);
        }
    }, [rawData]);

    useEffect(() => {
        if (selectedYears.length > 0) {
            setIsLoading(true);
            prepareChartData();
            setIsLoading(false);
        }
    }, [rawData, viewType, selectedYears]);

    const predefinedTypes = {
        "ATK": "rgba(255, 99, 132, 1)",
        "RTG": "rgba(54, 162, 235, 1)",
        "Entertaint": "rgba(255, 206, 86, 1)",
        "Parkir": "rgba(75, 192, 192, 1)",
        "Meals Lembur": "rgba(153, 102, 255, 1)",
        "Meals Meeting": "rgba(255, 159, 64, 1)",
        "Jenis Lain": "rgba(201, 203, 207, 1)",
    };

    const normalizeTypeName = (type) => {
        if (!type) return "Jenis Lain";

        // If it's a predefined type (case-insensitive check)
        const predefinedType = Object.keys(predefinedTypes).find(
            key => key.toLowerCase() === type.toLowerCase()
        );
        if (predefinedType) return predefinedType;

        return type
            .toLowerCase()
            .replace(/\s+/g, ' ')    
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getMonthlyColor = (index) => {
        const baseColors = [
            "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#FF9F40", "#9966FF",
            "#FFB6C1", "#8B4513", "#00BFFF", "#32CD32", "#FFD700", "#8A2BE2",
            "#FF6347", "#9ACD32", "#DC143C", "#FF1493", "#00FF7F", "#7FFF00",
            "#1E90FF", "#D2691E", "#8FBC8F", "#FF4500", "#ADFF2F", "#6495ED",
            "#BA55D3", "#87CEEB", "#9370DB", "#3CB371", "#FF69B4", "#40E0D0",
            "#4682B4", "#DA70D6", "#708090", "#2E8B57", "#FFA07A", "#6A5ACD",
            "#20B2AA", "#5F9EA0", "#FFDAB9", "#EE82EE", "#F08080", "#98FB98"
        ];
        return baseColors[index % baseColors.length];
    };

    const getYearlyColor = (jenis, index) => {
        // First check if it's a predefined type (case-insensitive)
        const predefinedType = Object.keys(predefinedTypes).find(
            key => key.toLowerCase() === jenis.toLowerCase()
        );
        if (predefinedType) {
            return predefinedTypes[predefinedType];
        }
        // For custom types, use the color generation function
        return getMonthlyColor(index);
    };

    const updateLegendItems = () => {
        if (!chartData || !chartData.datasets) return;

        const uniqueItems = new Set();
        chartData.datasets.forEach(dataset => {
            if (dataset.itemId) {
                uniqueItems.add(dataset.itemId);
            }
        });

        const items = Array.from(uniqueItems).map((itemId, index) => {
            const dataset = chartData.datasets.find(ds => ds.itemId === itemId);
            const isHidden = chartData.datasets
                .filter(ds => ds.itemId === itemId)
                .every(ds => ds.hidden);

            return {
                id: itemId,
                label: itemId,
                color: dataset.backgroundColor,
                hidden: isHidden
            };
        });
        
        setLegendItems(items);
    };

    const handleLegendClick = (clickedItem) => {
        if (!chartData) return;

        const newDatasets = chartData.datasets.map(dataset => {
            if (dataset.itemId === clickedItem.id) {
                dataset.hidden = !dataset.hidden;
            }
            return dataset;
        });

        setChartData({ ...chartData, datasets: newDatasets });
        updateLegendItems();
    };

    useEffect(() => {
        if (chartData) {
            updateLegendItems();
        }
    }, [chartData]);

    const prepareMonthlyData = () => {
        const allItems = new Set();
        rawData.forEach(item => {
            if (item.kategori === "GA/Umum") {
                if (showLPJ && item.lpj) {
                    item.lpj.forEach(lpjItem => {
                        if (lpjItem.namaItem) {
                            allItems.add(normalizeTypeName(lpjItem.namaItem));
                        }
                    });
                } else if (!showLPJ && item.reimbursements) {
                    item.reimbursements.forEach(reimb => {
                        if (reimb.item) {
                            allItems.add(normalizeTypeName(reimb.item));
                        }
                    });
                }
            }
        });
        const items = Array.from(allItems);

        // Initialize data structure
        const monthlyData = {};
        selectedYears.forEach(yearOption => {
            const year = yearOption.value;
            monthlyData[year] = Array(12).fill(null).map(() =>
                Object.fromEntries(items.map(item => [item, 0]))
            );
        });

        // Fill the data
        rawData.forEach(item => {
            if (item.kategori !== "GA/Umum") return;

            const date = new Date(item.tanggalPengajuan);
            const year = date.getFullYear().toString();
            const month = date.getMonth();

            if (monthlyData[year]) {
                if (showLPJ && item.lpj) {
                    item.lpj.forEach(lpjItem => {
                        const normalizedItem = normalizeTypeName(lpjItem.namaItem);
                        if (monthlyData[year][month][normalizedItem] !== undefined) {
                            monthlyData[year][month][normalizedItem] += lpjItem.jumlah || 1;
                        }
                    });
                } else if (!showLPJ && item.reimbursements) {
                    item.reimbursements.forEach(reimb => {
                        const normalizedItem = normalizeTypeName(reimb.item);
                        if (monthlyData[year][month][normalizedItem] !== undefined) {
                            monthlyData[year][month][normalizedItem]++;
                        }
                    });
                }
            }
        });

        // Create datasets
        const datasets = [];
        items.forEach((item, colorIndex) => {
            selectedYears.forEach(yearOption => {
                const year = yearOption.value;
                const data = Array(12).fill(null).map((_, monthIndex) => {
                    const yearData = monthlyData[year];
                    return yearData ? yearData[monthIndex][item] : 0;
                });

                if (data.every(value => value === 0)) return;

                datasets.push({
                    label: `${item} (${year})`,
                    data: data,
                    backgroundColor: getMonthlyColor(colorIndex),
                    borderColor: getMonthlyColor(colorIndex),
                    borderWidth: 1,
                    stack: year,
                    itemId: item
                });
            });
        });

        setChartData({
            labels: months,
            datasets: datasets
        });
    };

    const prepareYearlyData = () => {
        const allTypes = new Set();
        rawData.forEach(item => {
            if (item.kategori === "GA/Umum") {
                if (showLPJ && item.lpj) {
                    item.lpj.forEach(lpjItem => {
                        if (lpjItem.namaItem) {
                            allTypes.add(normalizeTypeName(lpjItem.namaItem));
                        }
                    });
                } else if (!showLPJ && item.reimbursements) {
                    item.reimbursements.forEach(reimb => {
                        if (reimb.jenis) {
                            allTypes.add(normalizeTypeName(reimb.jenis));
                        }
                    });
                }
            }
        });
        const types = Array.from(allTypes);

        // Count items by year and type
        const yearlyTotals = {};
        selectedYears.forEach(yearOption => {
            const year = parseInt(yearOption.value);
            yearlyTotals[year] = Object.fromEntries(types.map(type => [type, 0]));
        });

        rawData.forEach(item => {
            if (item.kategori !== "GA/Umum") return;

            const year = new Date(item.tanggalPengajuan).getFullYear();
            if (yearlyTotals[year]) {
                if (showLPJ && item.lpj) {
                    item.lpj.forEach(lpjItem => {
                        const normalizedItem = normalizeTypeName(lpjItem.namaItem);
                        if (yearlyTotals[year][normalizedItem] !== undefined) {
                            yearlyTotals[year][normalizedItem] += lpjItem.jumlah || 1;
                        }
                    });
                } else if (!showLPJ && item.reimbursements) {
                    item.reimbursements.forEach(reimb => {
                        if (reimb.jenis) {
                            const normalizedType = normalizeTypeName(reimb.jenis);
                            yearlyTotals[year][normalizedType]++;
                        }
                    });
                }
            }
        });

        const datasets = types.map((type, index) => {
            const data = selectedYears.map(year => yearlyTotals[parseInt(year.value)][type]);

            if (data.every(value => value === 0)) return null;

            return {
                label: type,
                data: data,
                backgroundColor: getYearlyColor(type, index),
                borderColor: getYearlyColor(type, index),
                borderWidth: 1,
                stack: '',
                itemId: type
            };
        }).filter(dataset => dataset !== null);

        setChartData({
            labels: selectedYears.map(year => `${year.value}`),
            datasets: datasets
        });
    };

    const prepareChartData = () => {
        if (!rawData || !rawData.length || selectedYears.length === 0) return;

        if (viewType === 'monthly') {
            prepareMonthlyData();
        } else {
            prepareYearlyData();
        }
    };

    const selectStyles = {
        control: (base) => ({
            ...base,
            minHeight: '32px',
            fontSize: '14px',
            display: 'flex',
            flexWrap: 'nowrap',
            overflow: 'auto'
        }),
        valueContainer: (base) => ({
            ...base,
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
            overflow: 'auto',
            '::-webkit-scrollbar': {
                display: 'none'
            },
            scrollbarWidth: 'none'
        }),
        menu: (base) => ({
            ...base,
            zIndex: 100
        }),
        multiValue: (base) => ({
            ...base,
            fontSize: '14px',
            flexShrink: 0
        }),
    };

    if (isLoading || !chartData) {
        return (
            <div className="flex justify-center items-center h-96">
                <ClipLoader color="#ED1C24" size={60} />
            </div>
        );
    }

    return (
        <div className="w-full h-[80vh] md:h-[75vh] flex flex-col overflow-hidden">
            <div className="flex flex-col space-y-2 lg:space-y-0 landscape:space-y-0 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div className="flex items-center justify-between w-full">
                    <h2 className="text-base md:text-lg font-medium">
                        {showLPJ ? "Perbandingan Pengajuan LPJ BS GA/Umum" : "Perbandingan Pengajuan Reimbursement GA/Umum"}
                    </h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="block lg:hidden text-gray-500 hover:text-gray-800 text-4xl"
                        >
                            &times;
                        </button>
                    )}
                </div>
                <div className="flex flex-col landscape:flex-row space-y-4 md:space-y-0 landscape:space-y-0 md:flex-row md:justify-between landscape:justify-between md:items-center landscape:items-center lg:space-x-4 landscape:space-x-8">
                    <div className="w-full md:w-96 lg:w-64 xl:w-96 landscape:w-96">
                        <Select
                            isMulti
                            value={selectedYears}
                            onChange={setSelectedYears}
                            options={availableYears}
                            styles={selectStyles}
                            placeholder="Pilih tahun untuk dibandingkan"
                            className="text-sm"
                            isSearchable={false}
                        />
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-4 lg:space-y-0">
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-blue-600"
                                    name="viewType"
                                    value="monthly"
                                    checked={viewType === 'monthly'}
                                    onChange={(e) => setViewType(e.target.value)}
                                />
                                <span className="ml-2 text-sm">Per Bulan</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-blue-600"
                                    name="viewType"
                                    value="yearly"
                                    checked={viewType === 'yearly'}
                                    onChange={(e) => setViewType(e.target.value)}
                                />
                                <span className="ml-2 text-sm">Per Tahun</span>
                            </label>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="hidden lg:block text-gray-500 hover:text-gray-800 text-4xl lg:ml-4"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="mb-4">
                <div
                    className="grid grid-rows-2 landscape:grid-rows-auto gap-2 overflow-x-auto scrollbar pb-1 sm-landscape:grid-rows-1 sm-landscape:grid-cols-auto"
                    style={{ gridAutoFlow: 'column' }}
                >
                    {legendItems.map((item, index) => (
                        <button
                            key={item.id}
                            onClick={() => handleLegendClick(item)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 ${item.hidden
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                    backgroundColor: item.color,
                                    opacity: item.hidden ? 0.5 : 1
                                }}
                            />
                            <span className={item.hidden ? 'opacity-50' : ''}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto scrollbar">
                <div className="min-h-[380px] md:min-h-[340px] h-full">
                    <Bar
                        data={chartData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: {
                                    grid: {
                                        display: false
                                    },
                                    title: {
                                        display: true,
                                        text: viewType === 'monthly' ? 'Bulan' : 'Tahun',
                                        font: {
                                            size: 10,
                                        }
                                    },
                                    ticks: {
                                        maxRotation: 45,
                                        font: {
                                            size: 10,
                                        }
                                    }
                                },
                                y: {
                                    stacked: true,
                                    title: {
                                        display: true,
                                        text: showLPJ ? 'Jumlah Item' : 'Jumlah Pengajuan',
                                        font: {
                                            size: 10,
                                        }
                                    },
                                    ticks: {
                                        stepSize: 2,
                                        precision: 0,
                                        font: {
                                            size: 10,
                                        }
                                    }
                                }
                            },
                            plugins: {
                                legend: {
                                    display: false
                                },
                                datalabels: {
                                    display: (context) => {
                                        if (viewType !== 'monthly') return false;
                                        const stack = context.dataset.stack;
                                        const dataIndex = context.dataIndex;

                                        const stackDatasets = context.chart.data.datasets.filter(
                                            ds => ds.stack === stack && !ds.hidden
                                        );

                                        if (stackDatasets.length === 0) {
                                            const allStackDatasets = context.chart.data.datasets.filter(
                                                ds => ds.stack === stack
                                            );
                                            return context.dataset === allStackDatasets[0];
                                        }

                                        const stackTotal = stackDatasets.reduce((sum, dataset) => {
                                            return sum + (dataset.data[dataIndex] || 0);
                                        }, 0);

                                        let closestDataset = null;
                                        let smallestDistance = Infinity;

                                        stackDatasets.forEach((dataset, idx) => {
                                            const sumBefore = stackDatasets
                                                .slice(0, idx)
                                                .reduce((sum, d) => sum + (d.data[dataIndex] || 0), 0);
                                            const value = dataset.data[dataIndex] || 0;
                                            const middlePoint = sumBefore + (value / 2);
                                            const distance = Math.abs((stackTotal / 2) - middlePoint);

                                            if (distance < smallestDistance) {
                                                closestDataset = dataset;
                                                smallestDistance = distance;
                                            }
                                        });

                                        return context.dataset === closestDataset;
                                    },
                                    formatter: (value, context) => {
                                        if (viewType === 'monthly') {
                                            return context.dataset.stack;
                                        }
                                        return '';
                                    },
                                    font: {
                                        size: 12,
                                        weight: 'bold'
                                    },
                                    color: '#FFF',
                                    anchor: 'center',
                                    align: 'center',
                                    rotation: -90,
                                    offset: 4
                                }
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default GAUComparisonChart;