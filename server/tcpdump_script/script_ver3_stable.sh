#!/bin/bash
#       ^
#       |
#     Do not to check the shebang for your host machine

echo "The script : $0"
echo "The question no:$1"
echo "Path to dir(abs):$3"
echo "File names: $2"

source config2  # All the variables in the file is valid
                # and usable

PID_SUDOcommand=0
PID_TCPDUMP=0
COPROC_PIDS[0]=0
COPROC_FDS[0]=0

Qi=$1
FILE_PATH=$3
FNarr=("$2")    #seperating the filenames based on spaces
                #in between and stored in the FileNamearray


read -a FNarr <<< "$2"
#         ^
#  the array ZERO indexed array

echo "the complete elemtens-> ${FNarr[@]}"
echo "No of files inputed : ${#FNarr[@]}"


# Now all the elements are obtained
# getting the intial requirements from the config file

temp="Q_${Qi}_P"
PROTOCOL=${!temp}

temp="Q_${Qi}_PORT"
PORT=${!temp}

temp="Q_${Qi}_Nf"
Nf=${!temp}

temp="Q_${Qi}_Tc"
Tc=${!temp}


echo "protocol : $PROTOCOL"
echo "PORT : $PORT"
echo "No of files : $Nf"
echo "No of test cases:$Tc"

#============= INTITIAL TEST CASES ARE OVER ===================

#Testing for the number of files
# FNarr is the FILE NAME array

if [[ "$Nf" != "${#FNarr[@]}" ]];then
        echo -e "\033[31mNo of inputed and the required FILES does not match\033[0m"
        exit 101
fi

echo "FILES MATCHED!"

# Test  for compilation of the programs


count=1
for i in ${FNarr[@]};
do
        echo "compiling ptogram $i"
                                        #appending the porccess to a file
        gcc ${FILE_PATH}/$i -o "Q_${Qi}_OBJ_$count" #>> process.log

        if [[ "$?" == "1" ]];then
                echo -e "\033[31mCompilatoin error in $i\033[0m with exit code :100"
                exit 100
        fi

        echo -e "\033[32m$i compiled successfully\033[0m"

        ((count++))
done

#================= COMPILATION ARE OVER ==================

# STARTING THE TCP MODULE
# this appilication must be started of the execution of any program


###----- starting of the test case loop -----
for (( i=1;i<=$Tc;i++ ));
do
echo -e "\033[33m>RUNNING TEST CASE $i\033[0m"

 sudo tcpdump -i lo ${PROTOCOL} port ${PORT} -nn -A > transfer_${Qi}_T_${i}.log &
#                                                    ^
# this process made to be a background process ------|

# pgrep -P <PID> this command returns the PIDs of the child process in
# the parent process with the <PID>. As this bash script is the parent
# process the first and only is the SUDO command to execute TCPDUMP.
# The child process of this sudo command is the tcpdump. so the pgrep
# command is used again to get the pid of tcpdump


                     sleep 2    #<<<<<<<<<<<<<<<<<<< TIME REQUIRED TO BOOT TCPDUMP
                     temp=0
                     temp=$(pgrep -P $$)    # $$ -> pid of this script
                     echo "pid of SUDO command (pid):$temp"
                     PID_SUDOcommand=$temp
                     while true;
                     do
                        sleep 0.2    #<<<<< NO NEED OF CHANGE
                        PID_TCPDUMP=$(pgrep -P $temp)

                        if [[ -n "$PID_TCPDUMP" ]];then
                                break
                        fi
                     done

                     echo "PID of TCPDUMP :$PID_TCPDUMP"

echo -e "\033[32mgot executed the TCPDUMP\033[0m"

#============= execution of TCPDUMP completed =========

# Each object files is executed in the background.The programs are
# wait for input like it waits in the terminal. The programs are
# executed via the coproc. So each have it own write and read FD
# with that File Discriptor(FD) we can feed input to each program
# asynchronously

count=1

for (( k=1;k<=$Nf;k++ ));
do
        temp="Q_${Qi}_OBJ_$k"

          if [[ $count == 1 ]];then
                echo "CHECKING FOR PORT VACANCY"
                if [[ "$PROTOCOL" == "tcp" ]];then
                        shortform="t"
                elif [[ "$PROTOCOL" == "udp" ]];then
                        shortform="u"
                fi

                if [[ -z  "$(ss -npla$shortform | grep '${PORT}')" ]];then
                        echo -e "\033[32m the port is free\033[0m"
                fi

        while ss -tanp | grep ":$PORT"; do
            echo -e "\033[33m[INFO] Port $PORT still in use — waiting...\033[0m"
            #echo "$(ss -tanp | grep -q ":$PORT")"
            sleep 1
        done

        fi



        eval "coproc coproc_$k { ./$temp > Q_${Qi}_T_${i}_OUT_$k; }"
        echo "statuc of the execution of $temp : $?"

        temp_pid="coproc_${k}_PID"
        COPROC_PIDS[$k]=${!temp_pid}


        temp_fd="coproc_${k}[1]"
        eval "COPROC_FDS[$k]=\${$temp_fd}"

        sleep 1                 #<<<<<<<<<<<<<<<<<<<APPROPIRATE TIMING MUST BE DONE

        ((count++))
done

echo "the coproc fds -> ${COPROC_FDS[@]}"
echo "the coproc pids ->${COPROC_PIDS[@]}"


#============ RUNNING OF ALL FILES IS COMPLETED =========
#Now getting the variables from the config file
#using those config values to the the code against
#the test cases.

echo "No of test cases : $Tc"


# this loop iterate over each test cases
#for (( i=1;i<=$Tc;i++ ));
#do
        #echo -e "\033[33m>RUNNING TEST CASE $i\033[0m"

        temp="Q_${Qi}_T_${i}_S"
        seq=${!temp}
        echo "the sequence in string > $seq"
        read -a sequence <<< $seq
        # sequence holds the array of inputs to the programs

        count=1
        seq_fre[0]=0
        for s in ${sequence[@]};
        do
                echo "sending input to the $s program"

        #this is a frequency counter. counts the no of times
        # ith  program is inputed.
                if [[ -n ${seq_fre[$s]} ]];then
                        c=${seq_fre[$s]}
                        ((c++))
                        seq_fre[$s]=$c
                else
                        seq_fre[$s]=1
                fi

                echo "frequency : ${seq_fre[$s]}"
                line=""
                for (( k=1;k<=${seq_fre[$s]};k++ ));
                do
                        echo "running $k"
                        IFS= read -r line
                done  < Q_${Qi}_T_${i}_IN_$s


                echo "the content inputed to $s <- $line"

                temp_fd=${COPROC_FDS[$s]}
                echo "passing to the FD :$temp_fd"

                eval 'echo "${line}" >&"${temp_fd}"'
                sleep 0.1                               #<<<<<<<<< NEED REDUCTION IN TIME
                ((count++))
        done

### ----------- performing all the clean operation ---------
        echo "sleeping for 10 sec"
        sleep 10   #<<<<<<<<<<<<<<<<<<<<< NEED REDUTCION IN TIME

        #resetting the intial values of the frequency
        echo "size of ${#seq_fre[@]}"

        for s in ${sequence[@]};
        do
                seq_fre[$s]=0
        done




        echo "killing the tcpdump"
        sudo kill -2 "$PID_TCPDUMP"
        echo "status of killing tcpdump $?"

        #killing the sudo command
        echo "killing sudo command"
        kill -2 "$PID_SUDOcommand"

        #closing all the coproc

        for k in ${COPROC_PIDS[@]};
        do
                if [[ "$k" == 0 ]];then
                        continue
                fi
                tempchild=$(pgrep -P $k)
                echo -e "\033[34mchild process of $k\033[0m\n$tempchild"
                echo "killing child $tempchild"
                kill -2 $tempchild
                echo "status $?"
                wait $tempchild
                echo " killing $k"
                kill -TERM $k
                echo "status : $?"
        done


        #count_flag=0
        #closing their file discriptor FDs
        for k in ${COPROC_FDS[@]};
        do

                if [[ "$k" == 0 ]];then
                #       count_flag=1
                        continue
                fi

                echo  "removing FD $k"
                eval  "exec ${k}>&-"
                echo  "status :$?"
        done

        pending=$(pgrep -P $$)
        echo -e "\033[34mpending child process $pending\033[0m"


        pendingPIDS=($(pgrep -P $$))

        echo "no of pending process ${#pendingPIDS[@]}"
        if [[ ${#pendingPIDS[@]} -gt 1 ]];then
                for k in ${pendingPIDS[@]};
                do
                        echo -e "\033[34m KILLING PENDING PIDS:$k\033[0m"
                        kill -9 $k
                done

                echo -e "\033[31mkilled ghost pending process\033[0m"
        fi

        echo "waiting for 5 secs"
        sleep 5

        #========== TEST CAE EACH COMPLETED ========================


        # PERFORMING TRNSFER.LOG PROCESSIN
        # Transfer.log file holds the data that is transfer via the network
        # (in the specified port and protocol). To get the actual data that
        # is transfer we need to process the data to the real data.


        > meta_${Qi}_T_${i}.log
        > ack_${Qi}_T_${i}.log
        > data_${Qi}_T_${i}.log


        echo "protocol $PROTOCOL"

        length=0
        previous_line=""
        previous_meta=""

        REGEX_tcp='IP.*Flags.*ack.*win.*length\ [0-9]+'
        REGEX_udp='IP.* > .*UDP, length\ [0-9]+'

        protocol_regex="REGEX_$PROTOCOL"

        echo "regex name $protocol_regex"
        echo "regex->${!protocol_regex}"

        while IFS= read -r line;
        do
                if [[ $line =~ ${!protocol_regex} ]];then
                        echo $line >> meta_${Qi}_T_${i}.log

                        if [[ $length == "0" ]];then
                        #       echo "got length 0"
                                length=$(echo $line | awk '{print $NF}')
                                echo $previous_line >> ack_${Qi}_T_${i}.log
                                continue
                        fi

                        size=${#previous_line}
                        data=${previous_line:$((size-length))}
                        #echo "the data->$data"
                        echo "$data" >> data_${Qi}_T_${i}.log

                        length=$(echo $line | awk '{print $NF}')
                        #echo "the length:$length"

                fi

                previous_line=$line
        done < transfer_${Qi}_T_${i}.log
done