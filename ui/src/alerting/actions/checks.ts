// Libraries
import {Dispatch} from 'react'

// Constants
import * as copy from 'src/shared/copy/notifications'

// APIs
import * as api from 'src/client'

// Utils
import {getActiveTimeMachine, getSaveableView} from 'src/timeMachine/selectors'

//Actions
import {
  notify,
  Action as NotificationAction,
} from 'src/shared/actions/notifications'
import {
  Action as TimeMachineAction,
  setActiveTimeMachine,
} from 'src/timeMachine/actions'
import {setCheckStatus} from 'src/timeMachine/actions'
import {createCellWithView} from 'src/dashboards/actions'

// Types
import {
  Check,
  GetState,
  RemoteDataState,
  CheckViewProperties,
  View,
} from 'src/types'
import {createView} from 'src/shared/utils/view'
import {updateView} from 'src/dashboards/actions/views'

export type Action =
  | ReturnType<typeof setAllChecks>
  | ReturnType<typeof setCheck>
  | ReturnType<typeof removeCheck>

export const setAllChecks = (status: RemoteDataState, checks?: Check[]) => ({
  type: 'SET_ALL_CHECKS' as 'SET_ALL_CHECKS',
  payload: {status, checks},
})

export const setCheck = (check: Check) => ({
  type: 'SET_CHECK' as 'SET_CHECK',
  payload: {check},
})

export const removeCheck = (checkID: string) => ({
  type: 'REMOVE_CHECK' as 'REMOVE_CHECK',
  payload: {checkID},
})

export const getChecks = () => async (
  dispatch: Dispatch<Action | NotificationAction>,
  getState: GetState
) => {
  try {
    dispatch(setAllChecks(RemoteDataState.Loading))
    const {
      orgs: {
        org: {id: orgID},
      },
    } = getState()

    const resp = await api.getChecks({query: {orgID}})

    if (resp.status !== 200) {
      throw new Error(resp.data.message)
    }

    dispatch(setAllChecks(RemoteDataState.Done, resp.data.checks))
  } catch (e) {
    console.error(e)
    dispatch(setAllChecks(RemoteDataState.Error))
    dispatch(notify(copy.getChecksFailed(e.message)))
  }
}

export const getCheckForTimeMachine = (checkID: string) => async (
  dispatch: Dispatch<TimeMachineAction | NotificationAction>
) => {
  try {
    dispatch(setCheckStatus(RemoteDataState.Loading))

    const resp = await api.getCheck({checkID})

    if (resp.status !== 200) {
      throw new Error(resp.data.message)
    }

    const check = resp.data

    const view = createView<CheckViewProperties>('check')
    // todo: when check has own view get view here until then:
    view.properties.queries = [check.query]

    dispatch(
      setActiveTimeMachine('alerting', {
        view,
        activeTab: 'alerting',
        alerting: {check, checkStatus: RemoteDataState.Done},
      })
    )
  } catch (e) {
    console.error(e)
    dispatch(setCheckStatus(RemoteDataState.Error))
    dispatch(notify(copy.getCheckFailed(e.message)))
  }
}

export const saveCheckFromTimeMachine = (dashboardID?: string) => async (
  dispatch: Dispatch<any>,
  getState: GetState
) => {
  try {
    const state = getState()
    const {
      orgs: {
        org: {id: orgID},
      },
    } = state

    const {
      draftQueries,
      alerting: {check},
    } = getActiveTimeMachine(state)

    const checkWithOrg = {...check, query: draftQueries[0], orgID} as Check

    const resp = check.id
      ? await api.patchCheck({checkID: check.id, data: checkWithOrg})
      : await api.postCheck({data: checkWithOrg})

    if (resp.status === 201 || resp.status === 200) {
      if (dashboardID) {
        const view = getSaveableView(state) as View<CheckViewProperties>
        view.properties.checkID = resp.data.id

        if (view.id) {
          await dispatch(updateView(dashboardID, view))
        } else {
          await dispatch(createCellWithView(dashboardID, view))
        }
      }

      dispatch(setCheck(resp.data))
    } else {
      throw new Error(resp.data.message)
    }
  } catch (e) {
    console.error(e)
    dispatch(notify(copy.createCheckFailed(e.message)))
  }
}

export const updateCheck = (check: Partial<Check>) => async (
  dispatch: Dispatch<Action | NotificationAction>
) => {
  try {
    const resp = await api.patchCheck({checkID: check.id, data: check as Check})

    if (resp.status === 200) {
      dispatch(setCheck(resp.data))
    } else {
      throw new Error(resp.data.message)
    }

    dispatch(setCheck(resp.data))
  } catch (e) {
    console.error(e)
    dispatch(notify(copy.updateCheckFailed(e.message)))
  }
}

export const deleteCheck = (checkID: string) => async (
  dispatch: Dispatch<Action | NotificationAction>
) => {
  try {
    const resp = await api.deleteCheck({checkID})

    if (resp.status === 204) {
      dispatch(removeCheck(checkID))
    } else {
      throw new Error(resp.data.message)
    }

    dispatch(removeCheck(checkID))
  } catch (e) {
    console.error(e)
    dispatch(notify(copy.deleteCheckFailed(e.message)))
  }
}
