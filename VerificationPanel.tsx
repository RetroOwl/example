import React, { useEffect, useRef, useState, } from 'react';
import Styles from './VerificationPanel.module.scss';
import { ReactComponent as FullView } from '../../../../assets/icons/fullView.svg';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../store/store';
import { Button, Input, Select, Spin } from 'antd';
import { BATCH_LVL_ENUM, LS_KEYS } from '../../../../constants';
import { useLazyGetFieldsQuery as useLazyGetFieldsQueryBatch } from '../../../../services/v2/batchServiceV2';
import { useLazyGetFieldsQuery as useLazyGetFieldsQueryFolder } from '../../../../services/v2/folderServiceV2';
import { useLazyGetFieldsQuery as useLazyGetFieldsQueryDocument } from '../../../../services/v2/documentServiceV2';
import FieldList from './FieldList/FieldList';
import FieldListInfo from './FieldList/FieldListInfo/FieldListInfo';
import { useAppDispatch } from '../../../../store/redux';
import { clearFields, setFields, } from '../../../../store/reducers/fieldsSlice';
import NotFieldsError from './FieldList/FieldErrors/NotFieldsError';

/**
 * Интерфейс структуры таблицы
 */
interface TableData {
    headers: number[][];
    data: number[][];
    cells: TableCell[];
}

/**
 * Интерфейс табличных значений
 */
interface TableCell {
    id: number;
    bbox: [number, number, number, number];
    page_number: number;
    value: string;
}

const VerificationPanel = () => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDefaultField, setDefaltField] = useState<boolean>(true);

    const { batch, currentItem } = useSelector(({batchReducerV2}: RootState) => batchReducerV2);
    const { keyItem, fields } = useSelector(({fieldsReducer}: RootState) => fieldsReducer);
    const { errorTextField } = useSelector(({ fieldsReducer }: RootState) => fieldsReducer);
    const { tablefields } = useSelector(({ fieldsReducer }: RootState) => fieldsReducer);

    const [getFieldsBatch] = useLazyGetFieldsQueryBatch();
    const [getFieldsFolder] = useLazyGetFieldsQueryFolder();
    const [getFieldsDocument] = useLazyGetFieldsQueryDocument();

    const [height, setHeight] = useState<number>(200);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [fullScreen, setFullScreen] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const dispatch = useAppDispatch();

    const selectFieldTab = (value: boolean): void => {
        setDefaltField(value);
    }

    let header: any[] = [];
    let cells: any[] = [];
    let data: any[] = [];

    if (tablefields) {
        try {
            const tableFields = tablefields;
            header = tablefields.header;
            cells = tablefields.cells;
            data = tablefields.data;    
        } catch (error) {
        }
    }

    const yourTableData: TableData = {
        headers: header,
        data: data,
        cells: cells
    };

    const renderGridTable = (tableData: TableData) => {
        const {headers, data, cells}: { headers: number[][], data: number[][], cells: TableCell[] } = tableData;

        const filteredData: number[][] = data.filter((row: number[]) => {
            const rowPageNumber: number[] = row.map((dataValue: number) => {
                const cellIndex: number = dataValue;
                const dataCell: TableCell = cells[cellIndex];
                return dataCell?.page_number;
            });
            return rowPageNumber.includes(currentPage);
        });

        return (
            <table className={Styles.GridTable}>
                <thead>
                {headers.map((row: number[], rowIndex: number) => (
                    <tr key={`header-row-${rowIndex}`}>
                        {row.reduce((columns: Array<{
                            value: string,
                            colSpan: number,
                            rowSpan: number
                        }>, headerValue: number, colIndex: number) => {
                            const headerIndex: number = headerValue;
                            const headerCell: TableCell = cells[headerIndex];
                            if (!headerCell) return columns;

                            if (headerValue === row[colIndex - 1]) {
                                columns[columns.length - 1].colSpan += 1;
                            } else {
                                const existingColumn: {
                                    value: string,
                                    colSpan: number,
                                    rowSpan: number
                                } | undefined = columns.find((column: {
                                    value: string,
                                    colSpan: number,
                                    rowSpan: number
                                }): boolean => column.value === headerCell.value);
                                if (existingColumn) {
                                    existingColumn.colSpan += 1;
                                } else {
                                    if (!(rowIndex === 1 && !(headerCell.value === "Код" || headerCell.value === "условное обозначение (национальное)" || headerCell.value === "цифровой Код" || headerCell.value === "краткое наименование"))) {
                                        columns.push({
                                            value: headerCell.value,
                                            colSpan: 1,
                                            rowSpan: 1
                                        });
                                    } else {
                                        columns.push({
                                            value: '',
                                            colSpan: 1,
                                            rowSpan: 1
                                        });
                                    }
                                }
                            }

                            return columns;
                        }, []).map((column: { value: string, colSpan: number, rowSpan: number }, colIndex: number) => (
                            <th
                                key={`header-cell-${colIndex}`}
                                colSpan={column.colSpan}
                                rowSpan={column.rowSpan}
                            >
                                {column.value}
                            </th>
                        ))}
                    </tr>
                ))}
                </thead>
                <tbody>
                {filteredData.map((row: number[], rowIndex: number) => (
                    <tr key={`data-row-${rowIndex}`}>
                        {row.map((dataValue: number, colIndex: number): JSX.Element | null => {
                            const cellIndex: number = dataValue;
                            const dataCell: TableCell = cells[cellIndex];
                            if (!dataCell) return null;

                            return (
                                <td
                                    key={`data-cell-${colIndex}`}
                                    style={{width: `auto`, height: `auto`}}
                                >
                                    <Input style={{height: 'auto', overflow: 'hidden', whiteSpace: 'pre-wrap'}}
                                           value={dataCell.value}/>
                                </td>
                            );
                        })}
                    </tr>
                ))}
                </tbody>
            </table>
        );
    };

    /**
     * Вызывает API метод и обрабатывает его ответ.
     *
     * @param func Функция API для вызова.
     * @param props Параметры для функции API.
     */
    const invokeAPI = (func: any, props: any): any | undefined => {
        if (!currentItem || !currentItem.key || !batch) return;

        const currentKey: React.Key[] = (
            func === getFieldsDocument
                ? [`${BATCH_LVL_ENUM.documents}-${props.id}-${currentItem.folder?.id}`]
                : currentItem.key
        ) as React.Key[];

        if (currentKey === keyItem) {
            setIsLoading(false);

            return;
        }

        return func(props)
            .unwrap()
            .then((resp: any): void => {
                setIsLoading(false);

                if (!resp.success) {
                    dispatch(setFields({keyItem: undefined, fields: undefined}));

                    console.error(resp.status_code);

                    return;
                }

                if (!resp.data) return;

                const fieldsData: { keyItem: React.Key[], fields: any } = {
                    keyItem: currentKey,
                    fields: resp.data,
                };

                dispatch(setFields(fieldsData));
            })
            .catch((err: any): void => {
                setIsLoading(false);
                dispatch(setFields({keyItem: undefined, fields: undefined}));

                console.error(err);
            });
    };

    /**
     * Перерисовывает поля выбранного элемента пачки.
     */
    const reloadFields = (): void => {
        if (currentItem && currentItem.key) {
            const batchLvl: number = Number(currentItem.key?.toString().split('-')[0]);
            const docId: number = Number(currentItem.key?.toString().split('-')[2]);

            if (batchLvl === BATCH_LVL_ENUM.page && fields && docId === Number(keyItem?.toString().split('-')[1])) return;

        }

        setIsLoading(true);

        if (!currentItem || !currentItem.key) {
            dispatch(clearFields());
            setIsLoading(false);

            return;
        }

        const [lvl, id] = currentItem.key.toString().split('-').map(Number);

        switch (lvl) {
            case BATCH_LVL_ENUM.batch: {
                invokeAPI(getFieldsBatch, {id});
                break;
            }
            case BATCH_LVL_ENUM.folder: {
                invokeAPI(getFieldsFolder, id);
                break;
            }
            case BATCH_LVL_ENUM.documents: {
                invokeAPI(getFieldsDocument, {id});
                break;
            }
            case BATCH_LVL_ENUM.page: {
                invokeAPI(getFieldsDocument, {id: currentItem.document?.id});
                break;
            }
            default: {
                dispatch(setFields({keyItem: undefined, fields: undefined}));

                setIsLoading(false);

                break;
            }
        }
    };

    useEffect(reloadFields, [currentItem]);

    const refBlock: React.RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const refBlockTable: React.RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);

    /**
     * Изменяет размер блока на основе положения курсора клиента.
     *
     * @param clientY - Вертикальная координата клиента.
     */
    const reSize = (clientY: number): void => {
        let dragY: number = clientY;
        let block: HTMLDivElement | null = refBlock.current;

        document.onmousemove = function onMouseMove(e: MouseEvent): void {
            if (block) {
                const deltaY: number = e.clientY - dragY;
                block.style.height = block.offsetHeight + deltaY + 'px';
            }

            dragY = e.clientY;
        };

        document.onmouseup = (): null => document.onmousemove = document.onmouseup = null;
    };

    const reSizeTable = (clientY: number): void => {
        let dragY: number = clientY;
        let block: HTMLDivElement | null = refBlockTable.current;

        document.onmousemove = function onMouseMove(e: MouseEvent): void {
            if (block) {
                const deltaY: number = e.clientY - dragY;
                block.style.height = block.offsetHeight - (deltaY * 5) + 'px';
            }

            dragY = e.clientY;
        };

        document.onmouseup = (): null => document.onmousemove = document.onmouseup = null;
    };

    const handleFullscreen = (): void => {
        if (fullScreen || height >= 500) {
            setFullScreen(false);
            setHeight(200);
        } else {
            setFullScreen(true);
            setHeight(10000);
        }
    }

    useEffect((): void => {
        const resizeableBlock: HTMLElement = document.querySelector('#resizeableBlock') as HTMLElement;

        if (resizeableBlock) {
            resizeableBlock.style.cursor = isDragging ? 'ns-resize' : 'default';
        }
        ;
    }, [isDragging]);

    return (
        <div className={Styles.container}>
            <div className={Styles.namePage}>
                <p>{batch?.class_label}</p>
            </div>

            {currentItem && <FieldListInfo/>}

            <div className={Styles.FieldsTab}>
                <Button
                    className={Styles.DefaultFields}
                    onClick={(): void => {
                        selectFieldTab(true);
                    }}
                    style={isDefaultField ? {backgroundColor: 'rgba(33, 38, 178, 0.938)', color: 'white'} : {}}
                >
                    Основные поля
                </Button>
                <Button
                    className={Styles.TableFields}
                    onClick={(): void => {
                        selectFieldTab(false);
                    }}
                    style={!isDefaultField ? {backgroundColor: 'rgba(33, 38, 178, 0.938)', color: 'white'} : {}}
                >
                    Табличные поля
                </Button>
            </div>

            <div className={Styles.groupBoxList} ref={refBlock}
                 style={{display: !isDefaultField ? 'none' : 'block'}}
            >
                {isLoading
                    ? <Spin size="large" className={Styles.spin}/>
                    : <FieldList refreshFields={reloadFields}/>
                }
            </div>

            <Select
                style={{display: isDefaultField ? 'none' : 'block', marginTop: 20, marginBottom: 20}}
                defaultValue={'1'}
            >
                <Select.Option value="1">Table 1</Select.Option>
                <Select.Option value="2">Table 2</Select.Option>
                <Select.Option value="3">Table 3</Select.Option>
            </Select>

            <hr onMouseDown={(e: React.MouseEvent<HTMLHRElement, MouseEvent>) => reSize(e.clientY)} className={Styles.hr}
                style={{display: !isDefaultField ? 'none' : 'block', marginTop: 20, marginBottom: 20}}/>

            <div
                className={Styles.GridDiv}
                ref={refBlockTable}
                style={{
                    display: isDefaultField ? 'none' : 'block',
                    height: `${height}px`,
                    overflow: 'auto'
                }}
            >
                <div onMouseDown={(e: React.MouseEvent<HTMLHRElement, MouseEvent>) => reSizeTable(e.clientY)}
                     className={Styles.GridTabletop}>
                    <h3 style={{position: 'absolute', top: -15, left: 10}}>Табличные данные</h3>
                    <button
                        style={{
                            position: 'absolute',
                            top: 1,
                            right: 5,
                            backgroundColor: "rgba(97, 97, 97, 0)",
                            border: "none"
                        }}
                        onClick={() => handleFullscreen()}
                    >
                        <FullView className={Styles.FullView}/>
                    </button>
                </div>

                {tablefields && batch ? renderGridTable(yourTableData) : <NotFieldsError/>}

                <div className={Styles.GridTablebottom}>
                    <Button style={{position: 'absolute', bottom: 8, right: 150}}>Сохранить</Button>
                    <Button style={{position: 'absolute', bottom: 8, right: 20}} disabled>По умолчанию</Button>
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 20,
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '10px'
                    }}>
                        <Button onClick={() => setCurrentPage(currentPage - 1)}>←</Button>
                        <h4 style={{margin: '0 10px', color: 'blue'}}>{currentPage}</h4>
                        <Button onClick={() => setCurrentPage(currentPage + 1)}>→</Button>
                    </div>
                </div>
            </div>

            <div className={Styles.bottom}>
                <div className={Styles.infoField}>
                    <h5>Текущая ошибка</h5>
                    <span>{errorTextField}</span>
                </div>
            </div>
        </div>
    );
};

export default VerificationPanel;